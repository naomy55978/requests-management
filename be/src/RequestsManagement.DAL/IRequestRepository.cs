using RequestsManagement.DTO;

namespace RequestsManagement.DAL;

/// <summary>
/// Read access to requests. Works with DTOs only: entities never leave the DAL (D-04),
/// and every query is projected to the needed columns inside the database.
/// </summary>
public interface IRequestRepository
{
    /// <summary>One page of requests that match the filter, plus the total count of matches.</summary>
    Task<PagedResult<RequestDto>> GetPageAsync(RequestFilter filter, CancellationToken cancellationToken);

    /// <returns>The request, or null if it does not exist.</returns>
    Task<RequestDto?> GetByIdAsync(int id, CancellationToken cancellationToken);

    /// <summary>Aggregations over all requests (GROUP BY in the database).</summary>
    Task<SummaryDto> GetSummaryAsync(CancellationToken cancellationToken);
}
