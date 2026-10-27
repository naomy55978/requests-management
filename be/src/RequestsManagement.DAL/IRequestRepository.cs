using RequestsManagement.DTO;
using RequestsManagement.DTO.Enums;

namespace RequestsManagement.DAL;

/// <summary>
/// Data access to requests: queries and the conditional status update. Works with DTOs only: entities never leave the DAL (D-04),
/// and every query is projected to the needed columns inside the database.
/// </summary>
public interface IRequestRepository
{
    /// <summary>One page of requests that match the filter, plus the total count of matches.</summary>
    Task<PagedResult<RequestDto>> GetPageAsync(RequestFilter filter, CancellationToken cancellationToken);

    /// <returns>The request, or null if it does not exist.</returns>
    Task<RequestDto?> GetByIdAsync(int id, CancellationToken cancellationToken);

    /// <summary>All status changes of a request, oldest first.</summary>
    /// <returns>The changes (empty for a request that never changed), or null if the request does not exist.</returns>
    Task<IReadOnlyList<StatusHistoryDto>?> GetHistoryAsync(int id, CancellationToken cancellationToken);

    /// <summary>Aggregations over all requests (GROUP BY in the database).</summary>
    Task<SummaryDto> GetSummaryAsync(CancellationToken cancellationToken);

    /// <summary>Changes the status only if the request still has <paramref name="expectedVersion"/> and a status in
    /// <paramref name="allowedPrevious"/> (computed by the BL), with the audit row in the same transaction (D-06).</summary>
    /// <returns>Updated, NotFound, Conflict (another version) or InvalidTransition (same version, status not allowed).</returns>
    Task<StatusUpdateResult> UpdateStatusAsync(
        int id,
        byte[] expectedVersion,
        RequestStatus newStatus,
        IReadOnlyCollection<RequestStatus> allowedPrevious,
        string changedBy,
        DateTime changedAt,
        CancellationToken cancellationToken);
}
