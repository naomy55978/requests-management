using Microsoft.AspNetCore.Mvc;
using RequestsManagement.API.Auth;
using RequestsManagement.BL;
using RequestsManagement.DTO;

namespace RequestsManagement.API.Controllers;

/// <summary>Requests: list, details, summary, status changes and their history. All endpoints require a token.</summary>
[ApiController]
[Route("api/requests")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
public class RequestsController(IRequestService requestService) : ControllerBase
{
    /// <summary>List requests with server-side paging, combined filters, text search and sorting.</summary>
    /// <remarks>
    /// All filters are optional and combined with AND.
    ///
    /// * **status**, **priority** – repeat the parameter to match any of several values (`status=New&amp;status=Waiting`).
    /// * **organization** – organization name starts with the given text.
    /// * **assignedTo** – handler user name starts with the given text (`dana` finds `dana.cohen`). Use the special
    ///   value **`unassigned`** (a keyword, not a prefix) to get only requests that have no handler yet
    ///   (about half of the New requests).
    /// * **createdFrom** / **createdTo** – whole UTC days (`2026-05-01`), both inclusive.
    /// * **search** – text contained in the title or in the organization name.
    /// * **sortBy** (`createdAt`, `updatedAt`, `priority`, `status`, `title`) and **sortDir** (`asc`, `desc`);
    ///   case is ignored. Equal values are ordered by id, so paging is stable.
    /// * **pageSize** is limited to 100.
    ///
    /// Invalid input is answered with 400 and a ValidationProblemDetails that lists every problem.
    /// </remarks>
    /// <response code="200">One page of requests and the total number of matches.</response>
    /// <response code="400">A parameter is invalid.</response>
    [HttpGet]
    [ProducesResponseType<PagedResult<RequestDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public Task<PagedResult<RequestDto>> GetPage([FromQuery] RequestFilter filter, CancellationToken cancellationToken) =>
        requestService.GetPageAsync(filter, cancellationToken);

    /// <summary>Aggregations: counts by status and by priority, and the organizations with the most open requests.</summary>
    /// <response code="200">The summary.</response>
    [HttpGet("summary")]
    [ProducesResponseType<SummaryDto>(StatusCodes.Status200OK)]
    public Task<SummaryDto> GetSummary(CancellationToken cancellationToken) =>
        requestService.GetSummaryAsync(cancellationToken);

    /// <summary>Get one request.</summary>
    /// <param name="id">Request id.</param>
    /// <param name="cancellationToken">Cancelled when the client disconnects.</param>
    /// <response code="200">The request. Its version must be sent back when the status is updated.</response>
    /// <response code="404">There is no request with this id.</response>
    [HttpGet("{id:int}")]
    [ProducesResponseType<RequestDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RequestDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var request = await requestService.GetByIdAsync(id, cancellationToken);
        return request is null ? NotFound() : request;
    }

    /// <summary>Status changes of a request, oldest first.</summary>
    /// <param name="id">Request id.</param>
    /// <param name="cancellationToken">Cancelled when the client disconnects.</param>
    /// <response code="200">All status changes (an empty list for a request whose status never changed).</response>
    /// <response code="404">There is no request with this id.</response>
    [HttpGet("{id:int}/history")]
    [ProducesResponseType<IReadOnlyList<StatusHistoryDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<StatusHistoryDto>>> GetHistory(int id, CancellationToken cancellationToken)
    {
        var history = await requestService.GetHistoryAsync(id, cancellationToken);
        return history is null ? NotFound() : Ok(history);
    }

    /// <summary>Change the status of a request (optimistic concurrency).</summary>
    /// <remarks>
    /// Send the `version` you received with the request. The change succeeds only if nobody changed the request
    /// in the meantime; otherwise the answer is **409** with the current status and version – reload and decide again.
    ///
    /// Allowed changes: New → InProgress, Waiting · InProgress → Waiting, Completed · Waiting → InProgress, Completed.
    /// Completed is final. Any other change is answered with **422**, listing the statuses allowed from the current one.
    ///
    /// The change is recorded in the history under the user of the access token.
    /// </remarks>
    /// <param name="id">Request id.</param>
    /// <param name="request">New status and the version you read.</param>
    /// <param name="cancellationToken">Cancelled when the client disconnects.</param>
    /// <response code="200">The updated request, with its new version.</response>
    /// <response code="400">The body is invalid (missing or unknown status, malformed version, unknown field).</response>
    /// <response code="404">There is no request with this id.</response>
    /// <response code="409">The request was changed by someone else since you read it (currentStatus, currentVersion).</response>
    /// <response code="422">This status change is not allowed (currentStatus, requestedStatus, allowedStatuses).</response>
    [HttpPatch("{id:int}/status")]
    [ProducesResponseType<RequestDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<RequestDto>> UpdateStatus(
        int id, UpdateStatusRequest request, CancellationToken cancellationToken)
    {
        // The acting user comes only from the validated token (D-10); the body has no such field
        var result = await requestService.UpdateStatusAsync(id, request, User.GetUserName(), cancellationToken);

        return result.Outcome switch
        {
            StatusUpdateOutcome.Updated => result.Request!,
            StatusUpdateOutcome.NotFound => NotFound(),
            StatusUpdateOutcome.Conflict => StatusProblem(
                StatusCodes.Status409Conflict,
                "The request was changed by another user.",
                "Reload the request and try again with its current version.",
                new()
                {
                    ["currentStatus"] = result.CurrentStatus.ToString(),
                    ["currentVersion"] = result.CurrentVersion,
                    ["currentUpdatedAt"] = result.CurrentUpdatedAt
                }),
            StatusUpdateOutcome.InvalidTransition => StatusProblem(
                StatusCodes.Status422UnprocessableEntity,
                "Status transition is not allowed.",
                $"Cannot change the status from {result.CurrentStatus} to {request.NewStatus}.",
                new()
                {
                    ["currentStatus"] = result.CurrentStatus.ToString(),
                    ["requestedStatus"] = request.NewStatus.ToString(),
                    ["allowedStatuses"] = result.AllowedStatuses!.Select(s => s.ToString()).ToArray(),
                    ["currentVersion"] = result.CurrentVersion
                }),
            _ => throw new InvalidOperationException($"Unexpected outcome {result.Outcome}.")
        };
    }

    /// <summary>Change the status of up to 100 requests at once (Partial Success).</summary>
    /// <remarks>
    /// Every item is its own update, exactly like **PATCH /api/requests/{id}/status**: it is checked against its
    /// `version`, the transition rules apply, and it is saved (with its history row) in its own transaction.
    /// A failed item does not stop or undo the others.
    ///
    /// The answer is **200** whenever the body is valid, even if every item failed. `succeeded` and `failed` are counts;
    /// `results` has one entry per item, in the order of the call, with the outcome:
    ///
    /// * **Updated** – the request is changed; `request` holds it with its new `version`.
    /// * **NotFound** – there is no request with this id.
    /// * **Conflict** – someone changed the request since you read it; `currentStatus`, `currentVersion`, `currentUpdatedAt`.
    ///   (Conflict is reported before InvalidTransition, as in the single update.)
    /// * **InvalidTransition** – the change is not allowed from the current status; `currentStatus`, `allowedStatuses`, `currentVersion`.
    ///
    /// The body must have 1 to 100 items and each request id at most once; otherwise nothing is changed and the
    /// answer is **400**. The changes are recorded in the history under the user of the access token.
    /// </remarks>
    /// <param name="request">New status and the requests with the versions you read.</param>
    /// <param name="cancellationToken">Cancelled when the client disconnects; items already saved stay saved.</param>
    /// <response code="200">Counts and a result per item.</response>
    /// <response code="400">The body is invalid (no items, more than 100, repeated id, bad version, unknown field, ...).</response>
    [HttpPost("bulk-status")]
    [ProducesResponseType<BulkStatusResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public Task<BulkStatusResponse> BulkUpdateStatus(BulkStatusRequest request, CancellationToken cancellationToken) =>
        // The acting user comes only from the validated token (D-10); the body has no such field
        requestService.BulkUpdateStatusAsync(request, User.GetUserName(), cancellationToken);

    // ProblemDetails (with traceId, like every other error) plus fields the client needs to react
    private ObjectResult StatusProblem(int statusCode, string title, string detail, Dictionary<string, object?> extensions)
    {
        var problem = ProblemDetailsFactory.CreateProblemDetails(HttpContext, statusCode, title, detail: detail);
        foreach (var (key, value) in extensions)
        {
            problem.Extensions[key] = value;
        }

        return new ObjectResult(problem) { StatusCode = statusCode, ContentTypes = { "application/problem+json" } };
    }
}
