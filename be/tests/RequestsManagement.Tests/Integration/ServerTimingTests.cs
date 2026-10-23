using System.Globalization;
using System.Net;
using RequestsManagement.DTO.Enums;
using RequestsManagement.Tests.Integration.Infrastructure;

namespace RequestsManagement.Tests.Integration;

/// <summary>
/// The Server-Timing response header (D-23, D-25): total and database time on every response, and the summary
/// cache outcome on the summary. Off unless ServerTiming:Enabled is set.
/// </summary>
[Collection(ApiCollection.Name)]
public class ServerTimingTests(ApiFixture fixture)
{
    /// <summary>"total;dur=1.2, db;dur=0.8;desc="2 queries"" → metric name → its parameters (dur, desc).</summary>
    private static Dictionary<string, Dictionary<string, string>> Parse(HttpResponseMessage response)
    {
        Assert.True(response.Headers.TryGetValues("Server-Timing", out var values), "no Server-Timing header");
        return string.Join(", ", values).Split(',', StringSplitOptions.TrimEntries).ToDictionary(
            metric => metric.Split(';')[0],
            metric => metric.Split(';').Skip(1).Select(p => p.Split('=', 2))
                .ToDictionary(p => p[0], p => p[1].Trim('"')));
    }

    private static double Duration(Dictionary<string, string> metric) =>
        double.Parse(metric["dur"], CultureInfo.InvariantCulture);

    [Fact]
    public async Task List_ReportsTotalAndDatabaseTime()
    {
        using var client = fixture.Client();

        var response = await client.GetAsync($"/api/requests?{TestData.Window}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var timing = Parse(response);
        Assert.Equal("2 queries", timing["db"]["desc"]);   // COUNT + one page
        Assert.True(Duration(timing["db"]) > 0);
        Assert.True(Duration(timing["total"]) >= Duration(timing["db"]), "the total includes the database time");
        Assert.False(timing.ContainsKey("cache"));         // only the summary reports the cache
    }

    [Fact]
    public async Task Summary_ReportsCacheMissAfterAChange_ThenHit()
    {
        // A successful status change empties the summary cache (D-11)
        var request = await fixture.InsertRequestAsync(RequestStatus.New);
        using var client = fixture.Client();
        var change = await ApiFixture.PatchStatusAsync(client, request.Id, RequestStatus.InProgress, request.Version);
        Assert.Equal(HttpStatusCode.OK, change.StatusCode);

        var miss = Parse(await client.GetAsync("/api/requests/summary"));
        var hit = Parse(await client.GetAsync("/api/requests/summary"));

        Assert.Equal("miss", miss["cache"]["desc"]);
        Assert.Equal("3 queries", miss["db"]["desc"]);     // the three aggregations
        Assert.Equal("hit", hit["cache"]["desc"]);
        Assert.Equal("0 queries", hit["db"]["desc"]);      // a hit does not touch the database
    }

    [Fact]
    public async Task ErrorResponses_HaveTheHeaderToo()
    {
        using var client = fixture.Client();
        using var anonymous = fixture.Client(userName: null);

        var notFound = await client.GetAsync("/api/requests/999999");
        var unauthorized = await anonymous.GetAsync("/api/requests");

        Assert.Equal(HttpStatusCode.NotFound, notFound.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);
        Assert.True(Duration(Parse(notFound)["total"]) >= 0);
        Assert.Equal("0 queries", Parse(unauthorized)["db"]["desc"]);   // rejected before any database work
    }

    [Fact]
    public async Task Header_IsNotSent_WhenTheSettingIsOff()
    {
        // A second instance of the API on the same database, with the default setting (off)
        using var factory = new ApiFactory(fixture.Database.ConnectionString, serverTiming: false);
        using var client = factory.CreateClient();
        using (var authorized = fixture.Client())
        {
            client.DefaultRequestHeaders.Authorization = authorized.DefaultRequestHeaders.Authorization;
        }

        var response = await client.GetAsync($"/api/requests?{TestData.Window}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains("Server-Timing"));
    }
}
