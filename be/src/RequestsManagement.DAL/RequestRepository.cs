using System.Data;
using System.Linq.Expressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using RequestsManagement.DAL.Entities;
using RequestsManagement.DTO;
using RequestsManagement.DTO.Enums;

namespace RequestsManagement.DAL;

internal sealed class RequestRepository(AppDbContext db) : IRequestRepository
{
    private const int TopOrganizationsCount = 10;
    private const string LikeEscape = "\\";

    // The columns the list needs, selected in SQL. RowVersion is converted to the DTO's base64 Version
    // in memory, for the rows of one page only.
    private sealed record RequestRow(
        int Id, string Title, string OrganizationName, RequestStatus Status, RequestPriority Priority,
        string? AssignedTo, DateTime CreatedAt, DateTime UpdatedAt, byte[] RowVersion)
    {
        public RequestDto ToDto() => new(
            Id, Title, OrganizationName, Status, Priority, AssignedTo, CreatedAt, UpdatedAt,
            Convert.ToBase64String(RowVersion));
    }

    private static readonly Expression<Func<Request, RequestRow>> ToRow = r => new RequestRow(
        r.Id, r.Title, r.OrganizationName, r.Status, r.Priority, r.AssignedTo, r.CreatedAt, r.UpdatedAt, r.RowVersion);

    public async Task<PagedResult<RequestDto>> GetPageAsync(RequestFilter filter, CancellationToken cancellationToken)
    {
        var query = ApplyFilter(db.Requests.AsNoTracking(), filter);

        // Two queries, both executed in the database: COUNT for the page numbers and one page of rows.
        // They run one after the other because a DbContext does not support parallel queries.
        var totalCount = await query.CountAsync(cancellationToken);
        if (totalCount == 0)
        {
            return new PagedResult<RequestDto>([], filter.Page, filter.PageSize, 0);
        }

        var rows = await ApplySort(query, filter)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(ToRow)
            .ToListAsync(cancellationToken);

        return new PagedResult<RequestDto>(rows.ConvertAll(r => r.ToDto()), filter.Page, filter.PageSize, totalCount);
    }

    public async Task<RequestDto?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var row = await db.Requests.AsNoTracking()
            .Where(r => r.Id == id)
            .Select(ToRow)
            .SingleOrDefaultAsync(cancellationToken);

        return row?.ToDto();
    }

    public async Task<IReadOnlyList<StatusHistoryDto>?> GetHistoryAsync(int id, CancellationToken cancellationToken)
    {
        // Seek on IX_RequestStatusHistory_RequestId_ChangedAt; rows come back already in ChangedAt order.
        // No paging: a request has only a handful of status changes.
        var history = await db.RequestStatusHistory.AsNoTracking()
            .Where(h => h.RequestId == id)
            .OrderBy(h => h.ChangedAt)
            .ThenBy(h => h.Id)
            .Select(h => new StatusHistoryDto(h.PreviousStatus, h.NewStatus, h.ChangedAt, h.ChangedBy))
            .ToListAsync(cancellationToken);

        // No rows: either a request that never changed (empty history) or no such request (null → 404)
        if (history.Count == 0 && !await db.Requests.AnyAsync(r => r.Id == id, cancellationToken))
        {
            return null;
        }

        return history;
    }

    public async Task<SummaryDto> GetSummaryAsync(CancellationToken cancellationToken)
    {
        var requests = db.Requests.AsNoTracking();

        var statusCounts = await requests
            .GroupBy(r => r.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var priorityCounts = await requests
            .GroupBy(r => r.Priority)
            .Select(g => new { Priority = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var topOrganizations = await requests
            .Where(r => r.Status != RequestStatus.Completed)
            .GroupBy(r => r.OrganizationName)
            .Select(g => new { OrganizationName = g.Key, OpenRequests = g.Count() })
            .OrderByDescending(o => o.OpenRequests)
            .ThenBy(o => o.OrganizationName)
            .Take(TopOrganizationsCount)
            .ToListAsync(cancellationToken);

        // GROUP BY returns only values that exist; list every status/priority so the client gets a stable shape
        var byStatus = Enum.GetValues<RequestStatus>()
            .Select(s => new StatusCountDto(s, statusCounts.FirstOrDefault(c => c.Status == s)?.Count ?? 0))
            .ToList();
        var byPriority = Enum.GetValues<RequestPriority>()
            .Select(p => new PriorityCountDto(p, priorityCounts.FirstOrDefault(c => c.Priority == p)?.Count ?? 0))
            .ToList();

        return new SummaryDto(
            byStatus.Sum(s => s.Count),
            byStatus,
            byPriority,
            topOrganizations.ConvertAll(o => new OrganizationCountDto(o.OrganizationName, o.OpenRequests)));
    }

    public async Task<StatusUpdateResult> UpdateStatusAsync(
        int id,
        byte[] expectedVersion,
        RequestStatus newStatus,
        IReadOnlyCollection<RequestStatus> allowedPrevious,
        string changedBy,
        DateTime changedAt,
        CancellationToken cancellationToken)
    {
        // The update and its audit row are written together or not at all
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // Optimistic concurrency enforced by the database (D-06): the row is changed only if it still has the
        // version the client read AND its current status may change to the new one. Both conditions are part of
        // the same UPDATE, so nothing can change between checking and writing. Concurrent updates with the same
        // version are serialized by the row lock: the first one changes the rowversion, so the others match 0 rows.
        // UpdatedAt is set in the same row write that makes SQL Server generate the new rowversion,
        // so the two always change together. OUTPUT returns the updated row and the previous status in one round trip.
        UpdatedRow? updated = null;
        if (allowedPrevious.Count > 0)
        {
            var statusParameters = allowedPrevious
                .Select((status, i) => new SqlParameter($"@allowed{i}", SqlDbType.TinyInt) { Value = (byte)status })
                .ToList();
            var sql = $"""
                UPDATE [Requests]
                SET [Status] = @newStatus, [UpdatedAt] = @changedAt
                OUTPUT deleted.[Status] AS [PreviousStatus], inserted.[Id], inserted.[Title], inserted.[OrganizationName],
                       inserted.[Status], inserted.[Priority], inserted.[AssignedTo], inserted.[CreatedAt],
                       inserted.[UpdatedAt], inserted.[RowVersion]
                WHERE [Id] = @id AND [RowVersion] = @expectedVersion
                  AND [Status] IN ({string.Join(", ", statusParameters.Select(p => p.ParameterName))})
                """;

            SqlParameter[] parameters =
            [
                new("@newStatus", SqlDbType.TinyInt) { Value = (byte)newStatus },
                new("@changedAt", SqlDbType.DateTime2) { Value = changedAt },
                new("@id", SqlDbType.Int) { Value = id },
                new("@expectedVersion", SqlDbType.Binary, 8) { Value = expectedVersion },
                .. statusParameters
            ];

            updated = (await db.Database.SqlQueryRaw<UpdatedRow>(sql, parameters).ToListAsync(cancellationToken))
                .SingleOrDefault();
        }

        if (updated is not null)
        {
            // Audit row (D-06): previous status comes from the database (OUTPUT deleted), never from the client.
            // A separate INSERT because OUTPUT ... INTO cannot target a table with a foreign key.
            await db.Database.ExecuteSqlAsync(
                $"""
                INSERT INTO [RequestStatusHistory] ([RequestId], [PreviousStatus], [NewStatus], [ChangedAt], [ChangedBy])
                VALUES ({id}, {(byte)updated.PreviousStatus}, {(byte)newStatus}, {changedAt}, {changedBy})
                """,
                cancellationToken);

            await transaction.CommitAsync(cancellationToken);
            return new StatusUpdateResult(StatusUpdateOutcome.Updated, updated.ToDto());
        }

        // 0 rows: find out why. Not found → 404; another version → 409 (the client's data is stale, so this wins
        // over 422); same version → the transition itself is not allowed → 422.
        // (If another update commits between the UPDATE above and this read, the answer is 409 – also correct:
        // the client has to reload either way.)
        var current = await db.Requests.AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => new { r.Status, r.RowVersion, r.UpdatedAt })
            .SingleOrDefaultAsync(cancellationToken);

        if (current is null)
        {
            return new StatusUpdateResult(StatusUpdateOutcome.NotFound);
        }

        var outcome = current.RowVersion.AsSpan().SequenceEqual(expectedVersion)
            ? StatusUpdateOutcome.InvalidTransition
            : StatusUpdateOutcome.Conflict;

        return new StatusUpdateResult(
            outcome,
            CurrentStatus: current.Status,
            CurrentVersion: Convert.ToBase64String(current.RowVersion),
            CurrentUpdatedAt: current.UpdatedAt);
    }

    /// <summary>Row returned by the OUTPUT clause of the status update (raw SQL result, so plain settable properties).</summary>
    private sealed class UpdatedRow
    {
        public RequestStatus PreviousStatus { get; set; }
        public int Id { get; set; }
        public string Title { get; set; } = null!;
        public string OrganizationName { get; set; } = null!;
        public RequestStatus Status { get; set; }
        public RequestPriority Priority { get; set; }
        public string? AssignedTo { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public byte[] RowVersion { get; set; } = null!;

        // Raw SQL results bypass the entity's UTC converter, so the kind is set here
        public RequestDto ToDto() => new(
            Id, Title, OrganizationName, Status, Priority, AssignedTo,
            DateTime.SpecifyKind(CreatedAt, DateTimeKind.Utc), DateTime.SpecifyKind(UpdatedAt, DateTimeKind.Utc),
            Convert.ToBase64String(RowVersion));
    }

    private static IQueryable<Request> ApplyFilter(IQueryable<Request> query, RequestFilter filter)
    {
        if (filter.Status is { Length: > 0 } statuses)
        {
            query = query.Where(r => statuses.Contains(r.Status));
        }

        if (filter.Priority is { Length: > 0 } priorities)
        {
            query = query.Where(r => priorities.Contains(r.Priority));
        }

        // Prefix match (LIKE 'x%') can use the OrganizationName index; "contains" is what Search is for
        if (!string.IsNullOrWhiteSpace(filter.Organization))
        {
            var prefix = EscapeLike(filter.Organization.Trim()) + "%";
            query = query.Where(r => EF.Functions.Like(r.OrganizationName, prefix, LikeEscape));
        }

        if (!string.IsNullOrWhiteSpace(filter.AssignedTo))
        {
            var assignedTo = filter.AssignedTo.Trim();
            query = string.Equals(assignedTo, RequestFilter.Unassigned, StringComparison.OrdinalIgnoreCase)
                ? query.Where(r => r.AssignedTo == null)
                : query.Where(r => r.AssignedTo == assignedTo);
        }

        // Both bounds are whole UTC days; the upper bound is exclusive of the next day
        if (filter.CreatedFrom is { } from)
        {
            var fromDate = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(r => r.CreatedAt >= fromDate);
        }

        if (filter.CreatedTo is { } to)
        {
            var beforeDate = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(r => r.CreatedAt < beforeDate);
        }

        // Contains search: LIKE '%x%' cannot use an index (known limitation, D-12)
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var pattern = "%" + EscapeLike(filter.Search.Trim()) + "%";
            query = query.Where(r =>
                EF.Functions.Like(r.Title, pattern, LikeEscape) ||
                EF.Functions.Like(r.OrganizationName, pattern, LikeEscape));
        }

        return query;
    }

    // Id is always the last sort key, so rows with equal values keep a stable order across pages
    private static IOrderedQueryable<Request> ApplySort(IQueryable<Request> query, RequestFilter filter)
    {
        var descending = filter.SortDir == SortDirection.Desc;
        return filter.SortBy switch
        {
            RequestSortField.CreatedAt => OrderBy(query, r => r.CreatedAt, descending),
            RequestSortField.UpdatedAt => OrderBy(query, r => r.UpdatedAt, descending),
            RequestSortField.Priority => OrderBy(query, r => r.Priority, descending),
            RequestSortField.Status => OrderBy(query, r => r.Status, descending),
            RequestSortField.Title => OrderBy(query, r => r.Title, descending),
            _ => throw new ArgumentOutOfRangeException(nameof(filter), filter.SortBy, "Unsupported sort field.")
        };
    }

    private static IOrderedQueryable<Request> OrderBy<TKey>(
        IQueryable<Request> query, Expression<Func<Request, TKey>> key, bool descending) =>
        descending
            ? query.OrderByDescending(key).ThenByDescending(r => r.Id)
            : query.OrderBy(key).ThenBy(r => r.Id);

    // Makes user text literal inside a LIKE pattern (escape character is a backslash)
    private static string EscapeLike(string text) => text
        .Replace(LikeEscape, LikeEscape + LikeEscape)
        .Replace("%", LikeEscape + "%")
        .Replace("_", LikeEscape + "_")
        .Replace("[", LikeEscape + "[");
}
