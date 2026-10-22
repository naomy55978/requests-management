using RequestsManagement.DTO;

namespace RequestsManagement.BL;

/// <summary>
/// Business operations on requests. Input rules (paging limits, allowed sort fields, ...) are declared on
/// the DTOs and already enforced before a call reaches the service (D-18).
/// </summary>
public interface IRequestService
{
    Task<PagedResult<RequestDto>> GetPageAsync(RequestFilter filter, CancellationToken cancellationToken);

    /// <returns>The request, or null if it does not exist.</returns>
    Task<RequestDto?> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<SummaryDto> GetSummaryAsync(CancellationToken cancellationToken);

    /// <returns>All status changes of the request, oldest first, or null if the request does not exist.</returns>
    Task<IReadOnlyList<StatusHistoryDto>?> GetHistoryAsync(int id, CancellationToken cancellationToken);

    /// <summary>
    /// Changes the status of a request with optimistic concurrency, enforcing the transition rules (D-05, D-06).
    /// </summary>
    /// <param name="id">Request id.</param>
    /// <param name="request">New status and the version the client read (already validated).</param>
    /// <param name="changedBy">The authenticated user, taken from the token by the caller – never from the body.</param>
    /// <param name="cancellationToken">Cancelled when the client disconnects.</param>
    Task<StatusUpdateResult> UpdateStatusAsync(
        int id, UpdateStatusRequest request, string changedBy, CancellationToken cancellationToken);
}
