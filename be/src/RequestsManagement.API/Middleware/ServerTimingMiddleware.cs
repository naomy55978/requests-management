using System.Diagnostics;
using System.Globalization;
using RequestsManagement.DTO.Diagnostics;

namespace RequestsManagement.API.Middleware;

/// <summary>
/// Adds the W3C <c>Server-Timing</c> header to every response (D-23, D-25), e.g.
/// <c>total;dur=12.4, db;dur=8.1;desc="2 queries", cache;desc="miss"</c>.
/// Browser DevTools show it under Network → Timing, and the UI (M7) reads it to show the server time.
/// </summary>
/// <remarks>
/// Enabled only by the ServerTiming:Enabled setting (on in Development): the header exposes internal timings.
/// It is the first middleware, so "total" includes everything the server does, also for error responses.
/// The values are taken when the response starts, i.e. before the body is written.
/// </remarks>
internal sealed class ServerTimingMiddleware(RequestDelegate next)
{
    public const string HeaderName = "Server-Timing";

    public Task InvokeAsync(HttpContext context, RequestTimings timings)
    {
        var start = Stopwatch.GetTimestamp();
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = Format(Stopwatch.GetElapsedTime(start), timings);
            return Task.CompletedTask;
        });

        return next(context);
    }

    internal static string Format(TimeSpan total, RequestTimings timings)
    {
        var metrics = new List<string>
        {
            $"total;dur={Milliseconds(total)}",
            $"db;dur={Milliseconds(timings.DbTime)};desc=\"{timings.DbCommands} {(timings.DbCommands == 1 ? "query" : "queries")}\""
        };

        if (timings.SummaryCache is { } cache)
        {
            metrics.Add($"cache;desc=\"{(cache == CacheOutcome.Hit ? "hit" : "miss")}\"");
        }

        return string.Join(", ", metrics);
    }

    // Milliseconds with one decimal and a dot, whatever the server's culture
    private static string Milliseconds(TimeSpan duration) =>
        duration.TotalMilliseconds.ToString("0.0", CultureInfo.InvariantCulture);
}
