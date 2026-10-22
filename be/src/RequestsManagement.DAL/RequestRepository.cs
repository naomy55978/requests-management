using System.Linq.Expressions;
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
