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

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        // The client cancelled or disconnected: expected, not an error, and nobody waits for a body
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
        {
            logger.LogDebug(
                "{Method} {Path} was cancelled by the client", httpContext.Request.Method, httpContext.Request.Path);
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
