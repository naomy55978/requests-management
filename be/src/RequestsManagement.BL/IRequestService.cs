using RequestsManagement.DTO;

namespace RequestsManagement.BL;

/// <summary>
/// Business operations on requests. Input rules (paging limits, allowed sort fields, ...) are declared on
/// the DTOs and already enforced before a call reaches the service (D-18).
/// </summary>
public interface IRequestService
{
    /// <summary>One page of requests that match the filter, plus the total count of matches.</summary>
    Task<PagedResult<RequestDto>> GetPageAsync(RequestFilter filter, CancellationToken cancellationToken);

    /// <returns>The request, or null if it does not exist.</returns>
    Task<RequestDto?> GetByIdAsync(int id, CancellationToken cancellationToken);

    /// <summary>Aggregations over all requests (counts by status and priority, top organizations), served from a short-lived cache.</summary>
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

    /// <summary>
    /// Changes the status of up to 100 requests (D-08, Partial Success): every item is its own update with its own
    /// transaction, through the same path as <see cref="UpdateStatusAsync"/>, so one failed item does not affect the others.
    /// </summary>
    /// <param name="request">New status and the requests with their versions (already validated).</param>
    /// <param name="changedBy">The authenticated user, taken from the token by the caller – never from the body.</param>
    /// <param name="cancellationToken">Cancelled when the client disconnects; items already saved stay saved.</param>
    /// <returns>A result per item, in the order of the call.</returns>
    Task<BulkStatusResponse> BulkUpdateStatusAsync(
        BulkStatusRequest request, string changedBy, CancellationToken cancellationToken);
}
