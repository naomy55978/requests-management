using System.Diagnostics;
using Microsoft.Extensions.Logging;
using RequestsManagement.DAL;
using RequestsManagement.DTO;
using RequestsManagement.DTO.Diagnostics;
using RequestsManagement.DTO.Enums;

namespace RequestsManagement.BL;

internal sealed class RequestService(
    IRequestRepository repository, SummaryCache summaryCache, RequestTimings timings, TimeProvider timeProvider,
    ILogger<RequestService> logger)
    : IRequestService
{
    /// <summary>Logs the size, timing and filter kinds of every page query, but not its free text, which can contain personal data.</summary>
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

    /// <summary>Logs a lookup of a request that does not exist.</summary>
    public async Task<RequestDto?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var request = await repository.GetByIdAsync(id, cancellationToken);
        if (request is null)
        {
            logger.LogInformation("Request {RequestId} was not found", id);
        }

        return request;
    }

    /// <summary>Serves the summary through the cache and reports hit or miss for the Server-Timing header.</summary>
    public Task<SummaryDto> GetSummaryAsync(CancellationToken cancellationToken)
    {
        // Reported in the Server-Timing header (D-25): a hit unless the cache has to load (LoadSummaryAsync)
        timings.SummaryCache = CacheOutcome.Hit;
        return summaryCache.GetOrCreateAsync(LoadSummaryAsync, cancellationToken);
    }

    /// <summary>Loads the summary from the database on a cache miss and logs how long it took.</summary>
    private async Task<SummaryDto> LoadSummaryAsync(CancellationToken cancellationToken)
    {
        timings.SummaryCache = CacheOutcome.Miss;
        var stopwatch = Stopwatch.StartNew();
        var summary = await repository.GetSummaryAsync(cancellationToken);

        logger.LogInformation(
            "Summary calculated for {Total} requests in {ElapsedMs} ms", summary.Total, stopwatch.ElapsedMilliseconds);

        return summary;
    }

    public Task<IReadOnlyList<StatusHistoryDto>?> GetHistoryAsync(int id, CancellationToken cancellationToken) =>
        repository.GetHistoryAsync(id, cancellationToken);

    /// <summary>Invalidates the cached summary after a committed change and logs the outcome of every attempt.</summary>
    public async Task<StatusUpdateResult> UpdateStatusAsync(
        int id, UpdateStatusRequest request, string changedBy, CancellationToken cancellationToken)
    {
        var newStatus = request.NewStatus!.Value;
        var result = await ChangeStatusAsync(id, request.GetVersionBytes(), newStatus, changedBy, cancellationToken);

        // Only a committed change makes the cached summary wrong; a failed one (404, 409, 422) changed nothing
        if (result.Outcome == StatusUpdateOutcome.Updated)
        {
            summaryCache.Invalidate();
        }

        switch (result.Outcome)
        {
            case StatusUpdateOutcome.Updated:
                logger.LogInformation("Request {RequestId} status changed to {NewStatus}", id, newStatus);
                break;
            case StatusUpdateOutcome.NotFound:
                logger.LogInformation("Status change of request {RequestId}: not found", id);
                break;
            case StatusUpdateOutcome.Conflict:
                logger.LogInformation(
                    "Status change of request {RequestId} to {NewStatus} rejected: changed concurrently (now {CurrentStatus})",
                    id, newStatus, result.CurrentStatus);
                break;
            case StatusUpdateOutcome.InvalidTransition:
                logger.LogInformation(
                    "Status change of request {RequestId} rejected: {CurrentStatus} to {NewStatus} is not allowed",
                    id, result.CurrentStatus, newStatus);
                break;
        }

        return result;
    }

    /// <summary>Runs the items one after the other, invalidates the cached summary once if any item was saved, and logs the outcome counts.</summary>
    public async Task<BulkStatusResponse> BulkUpdateStatusAsync(
        BulkStatusRequest request, string changedBy, CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var newStatus = request.NewStatus!.Value;
        var items = request.Items!;
        var results = new List<BulkStatusItemResult>(items.Count);

        // One after the other, each item through the same path as a single change (its own transaction, D-08):
        // a failed item does not affect the others. Sequential because a DbContext is not thread-safe, and it
        // also means the bulk call holds a lock on one row at a time, so two overlapping bulk calls cannot deadlock.
        // If the client disconnects, the loop stops; items already saved stay saved.
        var updatedCount = 0;
        try
        {
            foreach (var item in items)
            {
                var result = await ChangeStatusAsync(
                    item!.Id, item.GetVersionBytes(), newStatus, changedBy, cancellationToken);

                if (result.Outcome == StatusUpdateOutcome.Updated)
                {
                    updatedCount++;
                }
                else
                {
                    // Ids and outcomes only: no versions and no free text
                    logger.LogDebug(
                        "Bulk status change of request {RequestId} to {NewStatus}: {Outcome}", item.Id, newStatus, result.Outcome);
                }

                results.Add(new BulkStatusItemResult(
                    item.Id, result.Outcome, result.Request, result.CurrentStatus, result.CurrentVersion,
                    result.CurrentUpdatedAt, result.AllowedStatuses));
            }
        }
        finally
        {
            // In finally, because a disconnecting client stops the loop with an exception, while the items
            // saved before that are committed and already change the summary. One invalidation per call.
            if (updatedCount > 0)
            {
                summaryCache.Invalidate();
            }
        }

        var succeeded = results.Count(r => r.Outcome == StatusUpdateOutcome.Updated);
        logger.LogInformation(
            "Bulk status change to {NewStatus} by {ChangedBy}: {Total} requests, {Succeeded} updated, " +
            "{NotFound} not found, {Conflicts} conflicts, {Invalid} invalid transitions, in {ElapsedMs} ms",
            newStatus, changedBy, results.Count, succeeded,
            results.Count(r => r.Outcome == StatusUpdateOutcome.NotFound),
            results.Count(r => r.Outcome == StatusUpdateOutcome.Conflict),
            results.Count(r => r.Outcome == StatusUpdateOutcome.InvalidTransition),
            stopwatch.ElapsedMilliseconds);

        return new BulkStatusResponse(results.Count, succeeded, results.Count - succeeded, results);
    }

    /// <summary>
    /// The one status change used by both the single and the bulk update: the conditional database update
    /// with the allowed transitions (D-05, D-06). Each call is its own transaction.
    /// </summary>
    private async Task<StatusUpdateResult> ChangeStatusAsync(
        int id, byte[] expectedVersion, RequestStatus newStatus, string changedBy, CancellationToken cancellationToken)
    {
        // One timestamp for both UpdatedAt and the audit row's ChangedAt
        var now = timeProvider.GetUtcNow().UtcDateTime;

        var result = await repository.UpdateStatusAsync(
            id, expectedVersion, newStatus, StatusTransitions.AllowedPrevious(newStatus),
            changedBy, now, cancellationToken);

        // Tell the client which changes are possible from the current status
        return result.Outcome == StatusUpdateOutcome.InvalidTransition
            ? result with { AllowedStatuses = StatusTransitions.AllowedNext(result.CurrentStatus!.Value) }
            : result;
    }
}
