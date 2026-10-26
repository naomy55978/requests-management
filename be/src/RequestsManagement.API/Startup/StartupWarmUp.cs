using System.Diagnostics;
using RequestsManagement.BL;
using RequestsManagement.DAL;

namespace RequestsManagement.API.Startup;

/// <summary>
/// Calls the summary once before the API starts listening (D-48). Right after a Seed the database is cold: that
/// call reads the whole table and took 22 s on a loaded machine, close to the 30 s command timeout, and it is the
/// first thing the dashboard asks for. Doing it here warms the buffer pool, the statistics and the plan cache,
/// and fills the summary cache, so the first user request is fast.
/// </summary>
/// <remarks>
/// Runs in the API project, the composition root, because the summary is a BL service and the DAL (where the rest
/// of the startup initialization lives) must not know the BL (D-03). A failure only costs speed: it is logged and
/// the API starts anyway.
/// </remarks>
internal static class StartupWarmUp
{
    /// <summary>Longest wait for the warm-up. Each command also has its own 30 s timeout.</summary>
    public static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(60);

    /// <summary>Does nothing unless <see cref="DatabaseOptions.WarmUpOnStartup"/> is on. Never throws.</summary>
    /// <param name="services">The application's services; the summary is requested in a scope of its own.</param>
    /// <param name="logger">Where the progress and a failure are logged.</param>
    /// <param name="stopping">The host's shutdown token: the warm-up gives up when the application is stopping.</param>
    /// <param name="timeout">Overrides <see cref="DefaultTimeout"/> (for tests).</param>
    public static async Task RunAsync(
        IServiceProvider services, ILogger logger, CancellationToken stopping, TimeSpan? timeout = null)
    {
        if (!services.GetRequiredService<DatabaseOptions>().WarmUpOnStartup)
        {
            return;
        }

        using var limit = CancellationTokenSource.CreateLinkedTokenSource(stopping);
        limit.CancelAfter(timeout ?? DefaultTimeout);

        var stopwatch = Stopwatch.StartNew();
        logger.LogInformation("Warming up the database and the summary cache - the API starts listening when it is done");
        try
        {
            // Its own scope, like a request: the service and its DbContext are Scoped
            await using var scope = services.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<IRequestService>().GetSummaryAsync(limit.Token);
            logger.LogInformation("Warm-up done in {ElapsedMs} ms", stopwatch.ElapsedMilliseconds);
        }
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Warm-up did not finish after {ElapsedMs} ms (error, timeout or shutdown) - the API starts anyway, the first requests may be slow",
                stopwatch.ElapsedMilliseconds);
        }
    }
}
