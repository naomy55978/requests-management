using System.Net;
using System.Text.Json;
using RequestsManagement.DTO;
using RequestsManagement.DTO.Enums;
using RequestsManagement.Tests.Integration.Infrastructure;

namespace RequestsManagement.Tests.Integration;

/// <summary>
/// GET /api/requests/summary and its cache (D-11, D-20): the answer is the database's aggregation, a status change
/// is visible immediately, and a change that fails does not throw the cache away.
/// </summary>
/// <remarks>
/// The cache lives as long as the API does, and other tests add requests with plain SQL (which never clears it).
/// Every test therefore starts with <see cref="EmptyTheCacheAsync"/>, the way a real status change would.
/// </remarks>
[Collection(ApiCollection.Name)]
public class SummaryTests(ApiFixture fixture)
{
    private async Task<SummaryDto> GetSummaryAsync()
    {
        using var client = fixture.Client();
        var response = await client.GetAsync("/api/requests/summary");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadAsAsync<SummaryDto>();
    }

    /// <summary>A successful status change through the API: this is what empties the cache.</summary>
    private async Task EmptyTheCacheAsync()
    {
        var request = await fixture.InsertRequestAsync(RequestStatus.New);
        using var client = fixture.Client();
        var response = await ApiFixture.PatchStatusAsync(client, request.Id, RequestStatus.InProgress, request.Version);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static string Describe(SummaryDto summary) => JsonSerializer.Serialize(summary, ApiFixture.Json);

    private static int Count(SummaryDto summary, RequestStatus status) => summary.ByStatus.Single(s => s.Status == status).Count;

    [Fact]
    public async Task Summary_IsTheAggregationOfTheDatabase()
    {
        await EmptyTheCacheAsync();

        var summary = await GetSummaryAsync();

        // Every status and priority is listed, even with 0; the top organizations count only open requests
        Assert.Equal(Describe(await fixture.GetSummaryTruthAsync()), Describe(summary));
        Assert.Equal(Enum.GetValues<RequestStatus>(), summary.ByStatus.Select(s => s.Status));
        Assert.Equal(summary.Total, summary.ByStatus.Sum(s => s.Count));
    }

    [Fact]
    public async Task AfterAnUpdate_TheNextSummaryShowsTheChange()
    {
        var request = await fixture.InsertRequestAsync(RequestStatus.New);
        await EmptyTheCacheAsync();
        var before = await GetSummaryAsync();                 // now cached
        Assert.Equal(Describe(before), Describe(await GetSummaryAsync()));

        using var client = fixture.Client();
        await ApiFixture.PatchStatusAsync(client, request.Id, RequestStatus.InProgress, request.Version);
        var after = await GetSummaryAsync();

        Assert.Equal(Count(before, RequestStatus.New) - 1, Count(after, RequestStatus.New));
        Assert.Equal(Count(before, RequestStatus.InProgress) + 1, Count(after, RequestStatus.InProgress));
        Assert.Equal(before.Total, after.Total);
        Assert.Equal(Describe(await fixture.GetSummaryTruthAsync()), Describe(after));
    }

    [Fact]
    public async Task AfterABulkUpdate_TheNextSummaryShowsTheChange()
    {
        var requests = await fixture.InsertRequestsAsync(3, RequestStatus.New);
        await EmptyTheCacheAsync();
        var before = await GetSummaryAsync();                 // now cached

        // Three items change, one does not exist: the summary has to show exactly the three
        using var client = fixture.Client();
        var items = requests.Select(r => (r.Id, r.Version)).Append((999_999_999, "AAAAAAAAB9E="));
        var response = await ApiFixture.BulkAsync(client, RequestStatus.InProgress, items);
        Assert.Equal(3, (await response.ReadAsAsync<BulkStatusResponse>()).Succeeded);
        var after = await GetSummaryAsync();

        Assert.Equal(Count(before, RequestStatus.New) - 3, Count(after, RequestStatus.New));
        Assert.Equal(Count(before, RequestStatus.InProgress) + 3, Count(after, RequestStatus.InProgress));
        Assert.Equal(Describe(await fixture.GetSummaryTruthAsync()), Describe(after));
    }

    [Fact]
    public async Task FailedChanges_DoNotEmptyTheCache_ButASuccessfulOneDoes()
    {
        var completed = await fixture.InsertRequestAsync(RequestStatus.Completed);
        var untouched = await fixture.InsertRequestAsync(RequestStatus.New, RequestPriority.Low);
        await EmptyTheCacheAsync();
        var cached = await GetSummaryAsync();

        // A change made behind the API's back: the database no longer matches the cached summary. If the next
        // read still returns the cached one, it did not read the database - and neither can a read after a
        // failed change, unless that change threw the cache away.
        await fixture.Database.ExecuteAsync(
            "UPDATE [Requests] SET [Priority] = 3 WHERE [Id] = @id", ("@id", untouched.Id));
        Assert.NotEqual(Describe(await fixture.GetSummaryTruthAsync()), Describe(cached));
        Assert.Equal(Describe(cached), Describe(await GetSummaryAsync()));   // a plain hit does not read the database

        using var client = fixture.Client();
        var stale = await ApiFixture.PatchStatusAsync(client, untouched.Id, RequestStatus.InProgress, "AAAAAAAAB9E=");
        var missing = await ApiFixture.PatchStatusAsync(client, 999_999_999, RequestStatus.InProgress, "AAAAAAAAB9E=");
        var notAllowed = await ApiFixture.PatchStatusAsync(client, completed.Id, RequestStatus.InProgress, completed.Version);
        var allFailed = await ApiFixture.BulkAsync(client, RequestStatus.InProgress,
            [(999_999_999, "AAAAAAAAB9E="), (completed.Id, completed.Version)]);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, notAllowed.StatusCode);
        Assert.Equal(0, (await allFailed.ReadAsAsync<BulkStatusResponse>()).Succeeded);

        Assert.Equal(Describe(cached), Describe(await GetSummaryAsync()));   // still the cached one

        // One successful change and the summary is read from the database again
        var current = await fixture.GetRequestAsync(untouched.Id);
        var success = await ApiFixture.PatchStatusAsync(client, untouched.Id, RequestStatus.InProgress, current.Version);
        Assert.Equal(HttpStatusCode.OK, success.StatusCode);
        Assert.Equal(Describe(await fixture.GetSummaryTruthAsync()), Describe(await GetSummaryAsync()));
    }
}
