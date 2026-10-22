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
}
