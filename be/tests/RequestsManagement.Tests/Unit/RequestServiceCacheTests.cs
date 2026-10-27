using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using RequestsManagement.BL;
using RequestsManagement.DAL;
using RequestsManagement.DTO;
using RequestsManagement.DTO.Enums;

namespace RequestsManagement.Tests.Unit;

/// <summary>
/// When does a status change clear the cached summary (D-11, D-20)? The service runs against a fake repository
/// that answers the way the real one does for each outcome; the cached summary is "cleared" when the next
/// read has to load from the repository again.
/// </summary>
public class RequestServiceCacheTests
{
    private const string Version = "AAAAAAAAB9E=";

    private sealed class FakeRepository : IRequestRepository
    {
        public int SummaryLoads { get; private set; }

        /// <summary>What an update of the request with this id answers; an exception to throw instead.</summary>
        public Func<int, StatusUpdateResult> OnUpdate { get; set; } = _ => new StatusUpdateResult(StatusUpdateOutcome.Updated);

        public Task<SummaryDto> GetSummaryAsync(CancellationToken cancellationToken)
        {
            SummaryLoads++;
            return Task.FromResult(new SummaryDto(SummaryLoads, [], [], []));
        }

        public Task<StatusUpdateResult> UpdateStatusAsync(
            int id, byte[] expectedVersion, RequestStatus newStatus, IReadOnlyCollection<RequestStatus> allowedPrevious,
            string changedBy, DateTime changedAt, CancellationToken cancellationToken) =>
            Task.FromResult(OnUpdate(id));

        public Task<PagedResult<RequestDto>> GetPageAsync(RequestFilter filter, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<RequestDto?> GetByIdAsync(int id, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<StatusHistoryDto>?> GetHistoryAsync(int id, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }

    private static (RequestService Service, FakeRepository Repository) Create()
    {
        var repository = new FakeRepository();
        var cache = new SummaryCache(new MemoryCache(new MemoryCacheOptions()), NullLogger<SummaryCache>.Instance);
        var service = new RequestService(repository, cache, TimeProvider.System, NullLogger<RequestService>.Instance);
        return (service, repository);
    }

    private static StatusUpdateResult Result(StatusUpdateOutcome outcome) => outcome == StatusUpdateOutcome.InvalidTransition
        ? new StatusUpdateResult(outcome, CurrentStatus: RequestStatus.Completed)
        : new StatusUpdateResult(outcome, CurrentStatus: RequestStatus.InProgress);

    private static Task<StatusUpdateResult> Update(RequestService service, int id = 1) =>
        service.UpdateStatusAsync(id, new UpdateStatusRequest { NewStatus = RequestStatus.Waiting, Version = Version }, "dana.cohen", default);

    private static Task<BulkStatusResponse> Bulk(RequestService service, params int[] ids) =>
        service.BulkUpdateStatusAsync(
            new BulkStatusRequest
            {
                NewStatus = RequestStatus.Waiting,
                Items = ids.Select(id => (BulkStatusItem?)new BulkStatusItem { Id = id, Version = Version }).ToList()
            },
            "dana.cohen", default);

    /// <summary>Reads the summary twice; true if the second read had to load (the cache was cleared in between).</summary>
    private static async Task<bool> WasCleared(RequestService service, FakeRepository repository, Func<Task> change)
    {
        await service.GetSummaryAsync(default);          // fills the cache
        var loadsBefore = repository.SummaryLoads;
        await change();
        await service.GetSummaryAsync(default);
        return repository.SummaryLoads > loadsBefore;
    }

    [Fact]
    public async Task SuccessfulUpdate_ClearsTheCache()
    {
        var (service, repository) = Create();
        repository.OnUpdate = _ => Result(StatusUpdateOutcome.Updated);

        Assert.True(await WasCleared(service, repository, () => Update(service)));
    }

    [Theory]
    [InlineData(StatusUpdateOutcome.NotFound)]
    [InlineData(StatusUpdateOutcome.Conflict)]
    [InlineData(StatusUpdateOutcome.InvalidTransition)]
    public async Task FailedUpdate_LeavesTheCacheAlone(StatusUpdateOutcome outcome)
    {
        var (service, repository) = Create();
        repository.OnUpdate = _ => Result(outcome);

        Assert.False(await WasCleared(service, repository, () => Update(service)));
    }

    [Fact]
    public async Task Bulk_WithAtLeastOneUpdatedItem_ClearsTheCache()
    {
        var (service, repository) = Create();
        repository.OnUpdate = id => Result(id == 2 ? StatusUpdateOutcome.Updated : StatusUpdateOutcome.NotFound);

        var cleared = await WasCleared(service, repository, async () =>
        {
            var response = await Bulk(service, 1, 2, 3);
            Assert.Equal(1, response.Succeeded);
        });

        Assert.True(cleared);
    }

    [Fact]
    public async Task Bulk_WhereEveryItemFails_LeavesTheCacheAlone()
    {
        var (service, repository) = Create();
        repository.OnUpdate = id => Result(id == 1 ? StatusUpdateOutcome.Conflict : StatusUpdateOutcome.InvalidTransition);

        Assert.False(await WasCleared(service, repository, () => Bulk(service, 1, 2)));
    }

    [Fact]
    public async Task Bulk_StoppedByADisconnectAfterASavedItem_StillClearsTheCache()
    {
        // The client disconnects while the call runs: the loop stops with an exception, but the first item is
        // already committed (Partial Success, D-08) and changes the summary. Hence the invalidation in "finally".
        var (service, repository) = Create();
        repository.OnUpdate = id => id == 1
            ? Result(StatusUpdateOutcome.Updated)
            : throw new OperationCanceledException();

        var cleared = await WasCleared(service, repository, async () =>
            await Assert.ThrowsAsync<OperationCanceledException>(() => Bulk(service, 1, 2, 3)));

        Assert.True(cleared);
    }

    [Fact]
    public async Task Bulk_StoppedByADisconnectBeforeAnythingWasSaved_LeavesTheCacheAlone()
    {
        var (service, repository) = Create();
        repository.OnUpdate = _ => throw new OperationCanceledException();

        var cleared = await WasCleared(service, repository, async () =>
            await Assert.ThrowsAsync<OperationCanceledException>(() => Bulk(service, 1, 2)));

        Assert.False(cleared);
    }
}
