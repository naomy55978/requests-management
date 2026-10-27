using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using RequestsManagement.DTO;

namespace RequestsManagement.BL;

/// <summary>
/// In-memory cache of the summary (D-11). The summary is the most expensive endpoint (three GROUP BY queries over
/// all requests), it is read on every screen load, and it changes only when a status changes. Singleton: it holds
/// the state that all requests share.
/// </summary>
/// <remarks>
/// Entries live 60 seconds at most, and <see cref="Invalidate"/> removes them earlier after every successful
/// status change. The cache is per process: with several server instances each one has its own copy and
/// an invalidation reaches only its own instance (see docs/CACHE.md in the docs repository).
/// </remarks>
internal sealed class SummaryCache(IMemoryCache cache, ILogger<SummaryCache> logger)
{
    // The only place that defines the key and the lifetime
    private const string Key = "requests:summary";
    private static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(60);

    // One load plus at most one retry when a status change was committed during the first load
    private const int MaxLoads = 2;

    private readonly object _gate = new();

    // Raised by every invalidation. A summary is stored only if the generation did not change while it was
    // being loaded; otherwise it may have been read before a status change that was committed meanwhile.
    private int _generation;

    /// <summary>The cached summary, or <paramref name="load"/>'s result, which is cached unless a status change was committed meanwhile.</summary>
    /// <remarks>Simultaneous misses each load (no stampede protection, D-20); a failed or cancelled load is not cached.</remarks>
    public async Task<SummaryDto> GetOrCreateAsync(
        Func<CancellationToken, Task<SummaryDto>> load, CancellationToken cancellationToken)
    {
        if (cache.TryGetValue(Key, out SummaryDto? cached) && cached is not null)
        {
            logger.LogDebug("Summary cache hit");
            return cached;
        }

        logger.LogInformation("Summary cache miss, loading from the database");

        // A status change committed during the load makes its result older than that change: load once more, so the
        // caller gets the change too. Bounded to one retry; under constant changes the second result is returned uncached.
        for (var attempt = 1; ; attempt++)
        {
            var (summary, stored) = await LoadAndStoreAsync(load, cancellationToken);
            if (stored || attempt == MaxLoads)
            {
                return summary;
            }

            logger.LogDebug("Summary changed while it was loaded, loading again");
        }
    }

    /// <summary>Loads the summary and caches it only if no invalidation happened meanwhile; tells whether it was cached.</summary>
    private async Task<(SummaryDto Summary, bool Stored)> LoadAndStoreAsync(
        Func<CancellationToken, Task<SummaryDto>> load, CancellationToken cancellationToken)
    {
        int generationAtStart;
        lock (_gate)
        {
            generationAtStart = _generation;
        }

        var summary = await load(cancellationToken);

        // Checking the generation and storing are one step with respect to Invalidate: without the lock an
        // invalidation could slip in between and the old summary would be stored right after it
        lock (_gate)
        {
            if (generationAtStart != _generation)
            {
                return (summary, false);
            }

            cache.Set(Key, summary, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = Lifetime });
            return (summary, true);
        }
    }

    /// <summary>Drops the cached summary; call after a status change was committed.</summary>
    public void Invalidate()
    {
        lock (_gate)
        {
            _generation++;
            cache.Remove(Key);
        }

        logger.LogDebug("Summary cache invalidated");
    }
}
