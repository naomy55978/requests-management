using Microsoft.AspNetCore.Mvc;
using RequestsManagement.BL;
using RequestsManagement.DTO;

namespace RequestsManagement.API.Controllers;

/// <summary>Reading requests: list, details and summary.</summary>
[ApiController]
[Route("api/requests")]
public class RequestsController(IRequestService requestService) : ControllerBase
{
    /// <summary>List requests with server-side paging, combined filters, text search and sorting.</summary>
    /// <remarks>
    /// All filters are optional and combined with AND.
    ///
    /// * **status**, **priority** – repeat the parameter to match any of several values (`status=New&amp;status=Waiting`).
    /// * **organization** – organization name starts with the given text.
    /// * **assignedTo** – handler user name. Use the special value **`unassigned`** to get only requests that have
    ///   no handler yet (about half of the New requests).
    /// * **createdFrom** / **createdTo** – whole UTC days (`2026-05-01`), both inclusive.
    /// * **search** – text contained in the title or in the organization name.
    /// * **sortBy** (`CreatedAt`, `UpdatedAt`, `Priority`, `Status`, `Title`) and **sortDir** (`Asc`, `Desc`);
    ///   equal values are ordered by id, so paging is stable.
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
}
