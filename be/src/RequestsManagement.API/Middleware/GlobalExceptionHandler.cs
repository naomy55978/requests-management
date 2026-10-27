using Microsoft.AspNetCore.Diagnostics;

namespace RequestsManagement.API.Middleware;

/// <summary>
/// Last line of defence for exceptions nobody handled. Expected problems (invalid input, not found, ...)
/// never get here: they are answered as ProblemDetails where they are detected.
/// </summary>
internal sealed class GlobalExceptionHandler(
    IProblemDetailsService problemDetailsService,
    IHostEnvironment environment,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    // Non-standard status (used by nginx) for "the client closed the connection before the response"
    private const int ClientClosedRequest = 499;

    /// <summary>Answers an unhandled exception with a logged 500 ProblemDetails, or with 499 and no body when the client already disconnected.</summary>
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        // The client disconnected while the request was running: expected, not a server error, and nobody
        // waits for a body. ASP.NET already handles a plain OperationCanceledException before this handler
        // is called, but SqlClient can instead throw a SqlException ("Operation cancelled by user") when the
        // cancellation hits a command that is already running - so any exception counts after a disconnect.
        if (httpContext.RequestAborted.IsCancellationRequested)
        {
            logger.LogInformation(
                "{Method} {Path} failed after the client disconnected ({ExceptionType})",
                httpContext.Request.Method, httpContext.Request.Path, exception.GetType().Name);
            httpContext.Response.StatusCode = ClientClosedRequest;
            return true;
        }

        // Only the path is logged (never the query string or headers), so tokens and search text stay out of the log
        logger.LogError(
            exception, "Unhandled exception while processing {Method} {Path}",
            httpContext.Request.Method, httpContext.Request.Path);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails =
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred.",
                // The exception message can reveal internals, so it is shown only while developing
                Detail = environment.IsDevelopment() ? exception.Message : null
            }
        });
    }
}
