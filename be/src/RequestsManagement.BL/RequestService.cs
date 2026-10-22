using System.Diagnostics;
using Microsoft.Extensions.Logging;
using RequestsManagement.DAL;
using RequestsManagement.DTO;

namespace RequestsManagement.BL;

internal sealed class RequestService(IRequestRepository repository, ILogger<RequestService> logger) : IRequestService
{
    public async Task<PagedResult<RequestDto>> GetPageAsync(RequestFilter filter, CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var result = await repository.GetPageAsync(filter, cancellationToken);

        // Free text (search, organization, assignee) is not logged: it can contain personal data
        logger.LogInformation(
            "Requests page {Page} (size {PageSize}) returned {Count} of {TotalCount} in {ElapsedMs} ms " +
            "[sort {SortBy} {SortDir}, status filter: {HasStatus}, priority filter: {HasPriority}, " +
            "organization filter: {HasOrganization}, assignee filter: {HasAssignee}, date filter: {HasDates}, search: {HasSearch}]",
            filter.Page, filter.PageSize, result.Items.Count, result.TotalCount, stopwatch.ElapsedMilliseconds,
            filter.SortBy, filter.SortDir, filter.Status is { Length: > 0 }, filter.Priority is { Length: > 0 },
            !string.IsNullOrWhiteSpace(filter.Organization), !string.IsNullOrWhiteSpace(filter.AssignedTo),
            filter.CreatedFrom is not null || filter.CreatedTo is not null, !string.IsNullOrWhiteSpace(filter.Search));

        return result;
    }

    public async Task<RequestDto?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var request = await repository.GetByIdAsync(id, cancellationToken);
        if (request is null)
        {
            logger.LogInformation("Request {RequestId} was not found", id);
        }

        return request;
    }

    public async Task<SummaryDto> GetSummaryAsync(CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var summary = await repository.GetSummaryAsync(cancellationToken);

        logger.LogInformation(
            "Summary calculated for {Total} requests in {ElapsedMs} ms", summary.Total, stopwatch.ElapsedMilliseconds);

        return summary;
    }
}
