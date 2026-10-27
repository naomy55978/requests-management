using System.Net;
using RequestsManagement.DTO;
using RequestsManagement.DTO.Enums;
using RequestsManagement.Tests.Integration.Infrastructure;

namespace RequestsManagement.Tests.Integration;

/// <summary>POST /api/requests/bulk-status: Partial Success, every item its own update (D-08).</summary>
[Collection(ApiCollection.Name)]
public class BulkStatusTests(ApiFixture fixture)
{
    private const string UnknownVersion = "AAAAAAAAB9E=";

    [Fact]
    public async Task MixedCall_ReportsEveryOutcome_AndOnlyTheSuccessfulItemsChangeTheDatabase()
    {
        // Prepare one request for each outcome. "Stale" ones were changed by someone else after the caller read them.
        var updatesA = await fixture.InsertRequestAsync(RequestStatus.New);
        var updatesB = await fixture.InsertRequestAsync(RequestStatus.Waiting);
        var completed = await fixture.InsertRequestAsync(RequestStatus.Completed);
        var staleValidChange = await fixture.InsertRequestAsync(RequestStatus.New);
        var staleInvalidChange = await fixture.InsertRequestAsync(RequestStatus.New);
        using var other = fixture.Client("dana.cohen");
        var changedToWaiting = await ApiFixture.PatchStatusAsync(other, staleValidChange.Id, RequestStatus.Waiting, staleValidChange.Version);
        var changedToInProgress = await ApiFixture.PatchStatusAsync(other, staleInvalidChange.Id, RequestStatus.InProgress, staleInvalidChange.Version);
        Assert.Equal(HttpStatusCode.OK, changedToWaiting.StatusCode);
        Assert.Equal(HttpStatusCode.OK, changedToInProgress.StatusCode);

        // The call changes everything to InProgress. staleInvalidChange is already InProgress (a not allowed change
        // as well as a stale one), and Conflict has to win over InvalidTransition, as it does for a single update.
        const int missingId = 999_999_999;
        var items = new (int Id, string Version)[]
        {
            (updatesA.Id, updatesA.Version),
            (missingId, UnknownVersion),
            (staleValidChange.Id, staleValidChange.Version),
            (completed.Id, completed.Version),
            (updatesB.Id, updatesB.Version),
            (staleInvalidChange.Id, staleInvalidChange.Version)
        };
        var before = new Dictionary<int, (DbRequest Row, int HistoryRows)>();
        foreach (var id in items.Select(i => i.Id).Where(id => id != missingId))
        {
            before[id] = (await fixture.GetRequestAsync(id), (await fixture.GetHistoryAsync(id)).Count);
        }

        using var yossi = fixture.Client("yossi.friedman");
        var response = await ApiFixture.BulkAsync(yossi, RequestStatus.InProgress, items);

        // Always 200, with the counts and one result per item in the order of the call
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadAsAsync<BulkStatusResponse>();
        Assert.Equal((6, 2, 4), (result.Total, result.Succeeded, result.Failed));
        Assert.Equal(items.Select(i => i.Id), result.Results.Select(r => r.Id));
        Assert.Equal(
            [
                StatusUpdateOutcome.Updated, StatusUpdateOutcome.NotFound, StatusUpdateOutcome.Conflict,
                StatusUpdateOutcome.InvalidTransition, StatusUpdateOutcome.Updated, StatusUpdateOutcome.Conflict
            ],
            result.Results.Select(r => r.Outcome));

        // Updated: the new state in the answer, in the database, and one audit row by the user of the token
        foreach (var (index, previousStatus) in new[] { (0, RequestStatus.New), (4, RequestStatus.Waiting) })
        {
            var item = result.Results[index];
            var row = await fixture.GetRequestAsync(item.Id);
            Assert.Equal(RequestStatus.InProgress, item.Request!.Status);
            Assert.Equal(RequestStatus.InProgress, row.Status);
            Assert.Equal(item.Request.Version, row.Version);
            Assert.NotEqual(before[item.Id].Row.Version, row.Version);
            var history = await fixture.GetHistoryAsync(item.Id);
            Assert.Equal(new DbHistoryRow(previousStatus, RequestStatus.InProgress, row.UpdatedAt, "yossi.friedman"), Assert.Single(history));
        }

        // NotFound carries nothing else
        Assert.Equal(new BulkStatusItemResult(missingId, StatusUpdateOutcome.NotFound), result.Results[1]);

        // Conflict: the current state is reported; nothing was changed
        Assert.Equal(RequestStatus.Waiting, result.Results[2].CurrentStatus);
        Assert.Equal(before[staleValidChange.Id].Row.Version, result.Results[2].CurrentVersion);
        Assert.Equal(RequestStatus.InProgress, result.Results[5].CurrentStatus);   // Conflict, not InvalidTransition
        Assert.Equal(before[staleInvalidChange.Id].Row.Version, result.Results[5].CurrentVersion);

        // InvalidTransition: says where a Completed request can go (nowhere)
        Assert.Equal(RequestStatus.Completed, result.Results[3].CurrentStatus);
        Assert.Empty(result.Results[3].AllowedStatuses!);

        // Everything that failed is exactly as it was: same status, same version, no new audit row
        foreach (var id in new[] { staleValidChange.Id, completed.Id, staleInvalidChange.Id })
        {
            Assert.Equal(before[id].Row, await fixture.GetRequestAsync(id));
            Assert.Equal(before[id].HistoryRows, (await fixture.GetHistoryAsync(id)).Count);
        }
    }

    public static TheoryData<string> InvalidBodies() => new() { "no items", "more than 100 items", "a repeated id" };

    [Theory]
    [MemberData(nameof(InvalidBodies))]
    public async Task InvalidCall_Gives400_AndNotEvenTheValidItemsAreChanged(string kind)
    {
        var real = await fixture.InsertRequestAsync(RequestStatus.New);
        var before = await fixture.GetRequestAsync(real.Id);
        (int Id, string Version)[] items = kind switch
        {
            "no items" => [],
            "more than 100 items" => [(real.Id, real.Version), .. Enumerable.Range(900_000_000, 100).Select(id => (id, UnknownVersion))],
            _ => [(real.Id, real.Version), (real.Id, real.Version)]
        };
        using var client = fixture.Client();

        var response = await ApiFixture.BulkAsync(client, RequestStatus.InProgress, items);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.True((await response.ReadProblemAsync()).GetProperty("errors").TryGetProperty("items", out _));
        Assert.Equal(before, await fixture.GetRequestAsync(real.Id));
        Assert.Empty(await fixture.GetHistoryAsync(real.Id));
    }

    [Fact]
    public async Task AFullCallOfHundredRequests_UpdatesAllOfThemWithTheirAuditRows()
    {
        var requests = await fixture.InsertRequestsAsync(100, RequestStatus.New);
        using var client = fixture.Client();

        var response = await ApiFixture.BulkAsync(client, RequestStatus.InProgress, requests.Select(r => (r.Id, r.Version)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadAsAsync<BulkStatusResponse>();
        Assert.Equal((100, 100, 0), (result.Total, result.Succeeded, result.Failed));
        Assert.All(result.Results, r => Assert.Equal(StatusUpdateOutcome.Updated, r.Outcome));

        var ids = string.Join(",", requests.Select(r => r.Id));
        Assert.Equal(100, await fixture.Database.ScalarAsync<int>($"SELECT COUNT(*) FROM [Requests] WHERE [Id] IN ({ids}) AND [Status] = 2"));
        Assert.Equal(100, await fixture.Database.ScalarAsync<int>($"SELECT COUNT(DISTINCT [RequestId]) FROM [RequestStatusHistory] WHERE [RequestId] IN ({ids})"));
    }
}
