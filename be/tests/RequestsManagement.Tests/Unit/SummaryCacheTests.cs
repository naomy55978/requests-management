using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using RequestsManagement.BL;
using RequestsManagement.DTO;

namespace RequestsManagement.Tests.Unit;

public class SummaryCacheTests
{
    private static SummaryDto SummaryOf(int total) => new(total, [], [], []);

    private static SummaryCache CreateCache(MemoryCacheOptions? options = null) =>
        new(new MemoryCache(options ?? new MemoryCacheOptions()), NullLogger<SummaryCache>.Instance);

    /// <summary>A load function that counts how often the "database" was asked.</summary>
    private sealed class CountingLoad(int total = 1)
    {
        public int Calls { get; private set; }

        public Task<SummaryDto> LoadAsync(CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(SummaryOf(total));
        }
    }

    [Fact]
    public async Task SecondRead_IsServedFromTheCache()
    {
        var cache = CreateCache();
        var database = new CountingLoad();

        var first = await cache.GetOrCreateAsync(database.LoadAsync, CancellationToken.None);
        var second = await cache.GetOrCreateAsync(database.LoadAsync, CancellationToken.None);

        Assert.Equal(1, database.Calls);
        Assert.Same(first, second);
    }

    [Fact]
    public async Task AfterInvalidate_TheNextReadLoadsAgain()
    {
        var cache = CreateCache();
        var database = new CountingLoad();
        await cache.GetOrCreateAsync(database.LoadAsync, CancellationToken.None);

        cache.Invalidate();
        await cache.GetOrCreateAsync(database.LoadAsync, CancellationToken.None);

        Assert.Equal(2, database.Calls);
    }

    [Fact]
    public async Task InvalidationDuringALoad_PreventsTheOldResultFromBeingStored()
    {
        // The generation counter (D-20). A reader starts loading, a status change is committed and invalidates the
        // cache, and only then does the reader finish. Its result predates the change, so it may be returned to that
        // reader but must not stay in the cache, or the old summary would be served for the next 60 seconds.
        var cache = CreateCache();
        var loadCanFinish = new TaskCompletionSource();
        var slowLoads = 0;

        var slowRead = cache.GetOrCreateAsync(async _ =>
        {
            slowLoads++;
            await loadCanFinish.Task;
            return SummaryOf(total: 111); // the summary from before the change
        }, CancellationToken.None);

        cache.Invalidate();           // the change is committed while the reader is still loading
        loadCanFinish.SetResult();
        var slowResult = await slowRead;

        var afterwards = new CountingLoad(total: 222);
        var next = await cache.GetOrCreateAsync(afterwards.LoadAsync, CancellationToken.None);

        Assert.Equal(111, slowResult.Total);   // the reader that started before still gets its answer
        Assert.Equal(1, slowLoads);
        Assert.Equal(1, afterwards.Calls);     // the old result was not stored: this read had to load
        Assert.Equal(222, next.Total);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AFailedOrCancelledLoad_IsNotCached(bool cancelled)
    {
        var cache = CreateCache();
        var database = new CountingLoad();

        await Assert.ThrowsAnyAsync<Exception>(() => cache.GetOrCreateAsync(
            _ => cancelled ? throw new OperationCanceledException() : throw new InvalidOperationException("database down"),
            CancellationToken.None));
        await cache.GetOrCreateAsync(database.LoadAsync, CancellationToken.None);

        Assert.Equal(1, database.Calls);   // nothing was cached by the failed attempt, so this read loaded
    }

    [Fact]
    public async Task Entry_ExpiresAfterSixtySecondsFromItsCreation_AndReadsDoNotExtendIt()
    {
        // Absolute expiration (D-11) checked with a clock the test controls: no real 60 second wait.
        // (The real wait is checked once against a running API by scripts/verify-summary-cache.js.)
        var clock = new ManualClock();
        var cache = CreateCache(new MemoryCacheOptions { Clock = clock });
        var database = new CountingLoad();

        await cache.GetOrCreateAsync(database.LoadAsync, CancellationToken.None);
        clock.Advance(TimeSpan.FromSeconds(30));
        await cache.GetOrCreateAsync(database.LoadAsync, CancellationToken.None);   // a read in the middle
        clock.Advance(TimeSpan.FromSeconds(29));                                    // 59 s after the creation
        await cache.GetOrCreateAsync(database.LoadAsync, CancellationToken.None);
        Assert.Equal(1, database.Calls);

        clock.Advance(TimeSpan.FromSeconds(2));                                     // 61 s: the middle read did not extend it
        await cache.GetOrCreateAsync(database.LoadAsync, CancellationToken.None);
        Assert.Equal(2, database.Calls);
    }

    private sealed class ManualClock : Microsoft.Extensions.Internal.ISystemClock
    {
        public DateTimeOffset UtcNow { get; private set; } = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

        public void Advance(TimeSpan time) => UtcNow += time;
    }
}
