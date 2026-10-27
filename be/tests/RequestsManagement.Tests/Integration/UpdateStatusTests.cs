using System.Net;
using System.Text;
using RequestsManagement.DTO;
using RequestsManagement.DTO.Enums;
using RequestsManagement.Tests.Integration.Infrastructure;

namespace RequestsManagement.Tests.Integration;

/// <summary>
/// PATCH /api/requests/{id}/status and GET /history. Every test works on requests it created itself, and checks
/// both the answer and what is really in the database afterwards.
/// </summary>
[Collection(ApiCollection.Name)]
public class UpdateStatusTests(ApiFixture fixture)
{
    [Theory]
    [InlineData("dana.cohen")]
    [InlineData("yossi.friedman")]
    public async Task Update_ChangesTheRequest_AndWritesOneAuditRowByTheUserOfTheToken(string userName)
    {
        var request = await fixture.InsertRequestAsync(RequestStatus.New);
        using var client = fixture.Client(userName);

        var response = await ApiFixture.PatchStatusAsync(client, request.Id, RequestStatus.InProgress, request.Version);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.ReadAsAsync<RequestDto>();
        Assert.Equal(RequestStatus.InProgress, updated.Status);
        Assert.NotEqual(request.Version, updated.Version);

        // What the database holds, not only what the API says
        var row = await fixture.GetRequestAsync(request.Id);
        Assert.Equal(RequestStatus.InProgress, row.Status);
        Assert.Equal(updated.Version, row.Version);
        var history = Assert.Single(await fixture.GetHistoryAsync(request.Id));
        Assert.Equal(RequestStatus.New, history.PreviousStatus);   // the previous status comes from the database
        Assert.Equal(RequestStatus.InProgress, history.NewStatus);
        Assert.Equal(userName, history.ChangedBy);
        Assert.Equal(history.ChangedAt, row.UpdatedAt);            // UpdatedAt and the audit row share one timestamp
    }

    [Fact]
    public async Task ChangedByInTheBody_IsRejected_AndNothingIsChanged()
    {
        // The acting user is never taken from the client
        var request = await fixture.InsertRequestAsync(RequestStatus.New);
        using var client = fixture.Client();
        var body = new StringContent(
            $$"""{"newStatus":"InProgress","version":"{{request.Version}}","changedBy":"hacker"}""",
            Encoding.UTF8, "application/json");

        var response = await client.PatchAsync($"/api/requests/{request.Id}/status", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(RequestStatus.New, (await fixture.GetRequestAsync(request.Id)).Status);
        Assert.Empty(await fixture.GetHistoryAsync(request.Id));
    }

    [Fact]
    public async Task StaleVersion_Gives409WithTheCurrentState_AndTheRetryWithItSucceeds()
    {
        var request = await fixture.InsertRequestAsync(RequestStatus.New);
        using var first = fixture.Client("dana.cohen");
        using var second = fixture.Client("yossi.friedman");
        var firstChange = await ApiFixture.PatchStatusAsync(first, request.Id, RequestStatus.InProgress, request.Version);
        var currentVersion = (await firstChange.ReadAsAsync<RequestDto>()).Version;

        // The second user still has the version they read before the first change
        var stale = await ApiFixture.PatchStatusAsync(second, request.Id, RequestStatus.Waiting, request.Version);

        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var problem = await stale.ReadProblemAsync();
        Assert.Equal("InProgress", problem.GetProperty("currentStatus").GetString());
        Assert.Equal(currentVersion, problem.GetProperty("currentVersion").GetString());
        Assert.True(problem.TryGetProperty("currentUpdatedAt", out _));
        Assert.Single(await fixture.GetHistoryAsync(request.Id));   // the rejected change left no trace

        // 409 comes before 422: a stale client is told to reload first, even if its change is not allowed either
        var staleAndInvalid = await ApiFixture.PatchStatusAsync(second, request.Id, RequestStatus.InProgress, request.Version);
        Assert.Equal(HttpStatusCode.Conflict, staleAndInvalid.StatusCode);

        // With the current version the same user succeeds
        var retry = await ApiFixture.PatchStatusAsync(second, request.Id, RequestStatus.Waiting, currentVersion);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        var history = await fixture.GetHistoryAsync(request.Id);
        Assert.Equal(["dana.cohen", "yossi.friedman"], history.Select(h => h.ChangedBy).ToArray());
    }

    [Theory]
    [InlineData(RequestStatus.Completed, RequestStatus.InProgress, new RequestStatus[] { })]
    [InlineData(RequestStatus.New, RequestStatus.Completed, new[] { RequestStatus.InProgress, RequestStatus.Waiting })]
    [InlineData(RequestStatus.InProgress, RequestStatus.InProgress, new[] { RequestStatus.Waiting, RequestStatus.Completed })]
    public async Task NotAllowedTransition_Gives422WithTheAllowedStatuses_AndChangesNothing(
        RequestStatus from, RequestStatus to, RequestStatus[] allowed)
    {
        var request = await fixture.InsertRequestAsync(from);
        using var client = fixture.Client();

        var response = await ApiFixture.PatchStatusAsync(client, request.Id, to, request.Version);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.Equal(from.ToString(), problem.GetProperty("currentStatus").GetString());
        Assert.Equal(to.ToString(), problem.GetProperty("requestedStatus").GetString());
        Assert.Equal(allowed.Select(s => s.ToString()),
            problem.GetProperty("allowedStatuses").EnumerateArray().Select(s => s.GetString()));
        Assert.Equal(request.Version, problem.GetProperty("currentVersion").GetString());

        var row = await fixture.GetRequestAsync(request.Id);
        Assert.Equal(from, row.Status);
        Assert.Equal(request.Version, row.Version);
        Assert.Empty(await fixture.GetHistoryAsync(request.Id));
    }

    [Fact]
    public async Task UnknownRequest_Gives404()
    {
        using var client = fixture.Client();

        var response = await ApiFixture.PatchStatusAsync(client, 999_999, RequestStatus.InProgress, "AAAAAAAAB9E=");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Theory]
    [InlineData("{}", "newStatus")]
    [InlineData("""{"newStatus":"InProgress"}""", "version")]                              // version missing
    [InlineData("""{"newStatus":"Nope","version":"AAAAAAAAB9E="}""", "newStatus")]        // unknown status
    [InlineData("""{"newStatus":"InProgress","version":"***"}""", "version")]              // version is not a version
    [InlineData("""{"newStatus":"InProgress","version":""", "body")]                       // not JSON
    public async Task InvalidBody_Gives400_AndChangesNothing(string json, string expectedKey)
    {
        var request = await fixture.InsertRequestAsync(RequestStatus.New);
        using var client = fixture.Client();

        var response = await client.PatchAsync(
            $"/api/requests/{request.Id}/status", new StringContent(json, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.True((await response.ReadProblemAsync()).GetProperty("errors").TryGetProperty(expectedKey, out _),
            $"no error for '{expectedKey}'");
        Assert.Equal(RequestStatus.New, (await fixture.GetRequestAsync(request.Id)).Status);
        Assert.Empty(await fixture.GetHistoryAsync(request.Id));
    }

    [Fact]
    public async Task History_ListsTheChangesOldestFirst_IsEmptyForAnUntouchedRequest_And404ForAMissingOne()
    {
        var request = await fixture.InsertRequestAsync(RequestStatus.New);
        using var client = fixture.Client();

        var untouched = await client.GetAsync($"/api/requests/{request.Id}/history");
        Assert.Equal(HttpStatusCode.OK, untouched.StatusCode);
        Assert.Empty(await untouched.ReadAsAsync<List<StatusHistoryDto>>());

        var toInProgress = await ApiFixture.PatchStatusAsync(client, request.Id, RequestStatus.InProgress, request.Version);
        var version = (await toInProgress.ReadAsAsync<RequestDto>()).Version;
        using var other = fixture.Client("maya.levi");
        await ApiFixture.PatchStatusAsync(other, request.Id, RequestStatus.Completed, version);

        var history = await (await client.GetAsync($"/api/requests/{request.Id}/history")).ReadAsAsync<List<StatusHistoryDto>>();
        Assert.Equal(
            [
                (RequestStatus.New, RequestStatus.InProgress, "dana.cohen"),
                (RequestStatus.InProgress, RequestStatus.Completed, "maya.levi")
            ],
            history.Select(h => (h.PreviousStatus, h.NewStatus, h.ChangedBy)).ToArray());
        Assert.True(history[0].ChangedAt <= history[1].ChangedAt);

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/requests/999999/history")).StatusCode);
    }
}
