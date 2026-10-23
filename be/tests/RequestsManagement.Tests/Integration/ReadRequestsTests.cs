using System.Net;
using RequestsManagement.DTO;
using RequestsManagement.DTO.Enums;
using RequestsManagement.Tests.Integration.Infrastructure;

namespace RequestsManagement.Tests.Integration;

/// <summary>
/// Filtering, searching, sorting and paging happen in the database (not in the client). Each expected result is
/// calculated with LINQ from the fixed data list (<see cref="TestData"/>) and compared with the API's answer.
/// </summary>
[Collection(ApiCollection.Name)]
public class ReadRequestsTests(ApiFixture fixture)
{
    private sealed record Scenario(string Query, Func<SeedRequest, bool> Matches, bool CanBeEmpty = false);

    // Every query is limited to the fixed data (Window) unless it sets its own dates
    private static readonly Dictionary<string, Scenario> Scenarios = new()
    {
        ["status-and-priority"] = new(
            $"status=New&status=Waiting&priority=High&{TestData.Window}",
            r => r.Status is RequestStatus.New or RequestStatus.Waiting && r.Priority == RequestPriority.High),
        ["organization-prefix"] = new(
            $"organization=Co&{TestData.Window}",
            r => r.Organization.StartsWith("Co", StringComparison.OrdinalIgnoreCase)),
        ["assigned-to-a-user"] = new(
            $"assignedTo=dana.cohen&{TestData.Window}",
            r => r.AssignedTo == "dana.cohen"),
        ["unassigned"] = new(
            $"assignedTo=unassigned&{TestData.Window}",
            r => r.AssignedTo is null),
        ["date-range-is-inclusive"] = new(
            "createdFrom=2026-01-10&createdTo=2026-01-20",
            r => r.CreatedAt.Date >= new DateTime(2026, 1, 10) && r.CreatedAt.Date <= new DateTime(2026, 1, 20)),
        ["search-title-or-organization"] = new(
            $"search=echo&{TestData.Window}",
            r => r.Title.Contains("echo", StringComparison.OrdinalIgnoreCase) ||
                 r.Organization.Contains("echo", StringComparison.OrdinalIgnoreCase)),
        // % _ [ in the search text are plain characters, not LIKE wildcards. Unescaped, "Request 0%" would match
        // every title that starts with "Request 0", "Request _1" every "Request x1", and "[bracket]" any title
        // with one of the letters b, r, a, c, k, e, t.
        ["search-percent-is-literal"] = new($"search={Uri.EscapeDataString("Request 0%")}&{TestData.Window}", _ => false, CanBeEmpty: true),
        ["search-underscore-is-literal"] = new($"search={Uri.EscapeDataString("Request _1")}&{TestData.Window}", _ => false, CanBeEmpty: true),
        ["search-bracket-is-literal"] = new(
            $"search={Uri.EscapeDataString("[bracket]")}&{TestData.Window}",
            r => r.Title.Contains("[bracket]", StringComparison.Ordinal)),
        ["all-filters-combined"] = new(
            "status=InProgress&priority=Low&priority=Medium&organization=B&search=request&createdFrom=2026-01-01&createdTo=2026-02-10",
            r => r.Status == RequestStatus.InProgress && r.Priority is RequestPriority.Low or RequestPriority.Medium &&
                 r.Organization.StartsWith('B') && r.Title.Contains("request", StringComparison.OrdinalIgnoreCase) &&
                 r.CreatedAt.Date <= new DateTime(2026, 2, 10))
    };

    public static TheoryData<string> ScenarioNames() => new(Scenarios.Keys);

    // Sort fields and the key the oracle sorts by. Equal keys are ordered by id, in the sort direction.
    private static readonly Dictionary<RequestSortField, Func<SeedRequest, IComparable>> SortKeys = new()
    {
        [RequestSortField.CreatedAt] = r => r.CreatedAt,
        [RequestSortField.UpdatedAt] = r => r.UpdatedAt,
        [RequestSortField.Priority] = r => (byte)r.Priority,
        [RequestSortField.Status] = r => (byte)r.Status,
        // Ordinal comparison is the same as the database's, because the titles begin with different capital letters
        [RequestSortField.Title] = r => r.Title
    };

    public static TheoryData<RequestSortField, SortDirection> AllSorts()
    {
        var data = new TheoryData<RequestSortField, SortDirection>();
        foreach (var field in Enum.GetValues<RequestSortField>())
        {
            data.Add(field, SortDirection.Asc);
            data.Add(field, SortDirection.Desc);
        }

        return data;
    }

    private async Task<PagedResult<RequestDto>> GetPageAsync(string query)
    {
        using var client = fixture.Client();
        var response = await client.GetAsync($"/api/requests?{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadAsAsync<PagedResult<RequestDto>>();
    }

    private static List<int> Expected(Func<SeedRequest, bool> matches) =>
        // The default order: newest first
        TestData.Requests.Where(matches).OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id)
            .Select(r => r.Id).ToList();

    [Theory]
    [MemberData(nameof(ScenarioNames))]
    public async Task Filters_AreAppliedByTheServer(string scenarioName)
    {
        var scenario = Scenarios[scenarioName];
        var expected = Expected(scenario.Matches);
        if (!scenario.CanBeEmpty)
        {
            Assert.NotEmpty(expected);   // a scenario that selects nothing would prove nothing
        }

        var page = await GetPageAsync($"{scenario.Query}&pageSize=100");

        Assert.Equal(expected, page.Items.Select(r => r.Id).ToList());
        Assert.Equal(expected.Count, page.TotalCount);
    }

    [Theory]
    [MemberData(nameof(AllSorts))]
    public async Task Sorting_IsDoneByTheServer(RequestSortField field, SortDirection direction)
    {
        var key = SortKeys[field];
        var ordered = direction == SortDirection.Asc
            ? TestData.Requests.OrderBy(key).ThenBy(r => r.Id)
            : TestData.Requests.OrderByDescending(key).ThenByDescending(r => r.Id);

        var page = await GetPageAsync($"sortBy={field}&sortDir={direction}&pageSize=100&{TestData.Window}");

        Assert.Equal(ordered.Select(r => r.Id).ToList(), page.Items.Select(r => r.Id).ToList());
    }

    [Fact]
    public async Task Paging_ReturnsEveryRequestOnceAndKnowsTheTotal()
    {
        var expected = Expected(_ => true);
        var seen = new List<int>();

        for (var number = 1; ; number++)
        {
            var page = await GetPageAsync($"page={number}&pageSize=7&{TestData.Window}");
            Assert.Equal(expected.Count, page.TotalCount);   // the total does not depend on the page
            Assert.Equal(number, page.Page);
            Assert.Equal(7, page.PageSize);
            if (page.Items.Count == 0)
            {
                // A page after the last one is not an error
                Assert.True(number > page.TotalPages);
                break;
            }

            Assert.True(page.Items.Count <= 7);
            seen.AddRange(page.Items.Select(r => r.Id));
        }

        // 40 requests = 5 full pages + 5 left; together in the default order, none missing, none twice
        Assert.Equal(expected, seen);
    }

    [Theory]
    [InlineData("pageSize=101", "pageSize")]
    [InlineData("pageSize=abc", "pageSize")]
    [InlineData("page=0", "page")]
    [InlineData("sortBy=nonsense", "sortBy")]
    [InlineData("status=99", "status")]
    [InlineData("createdFrom=2026-05-02&createdTo=2026-05-01", "createdFrom")]
    public async Task InvalidQuery_IsAnswered400WithTheUsualErrorFormat(string query, string expectedKey)
    {
        using var client = fixture.Client();

        var response = await client.GetAsync($"/api/requests?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.ReadProblemAsync();
        Assert.True(problem.TryGetProperty("traceId", out _));
        Assert.True(problem.GetProperty("errors").TryGetProperty(expectedKey, out _), $"no error for '{expectedKey}'");
    }

    [Fact]
    public async Task GetById_ReturnsTheRequestWithItsVersion_And404WhenMissing()
    {
        var seeded = TestData.Requests[4];
        using var client = fixture.Client();

        var response = await client.GetAsync($"/api/requests/{seeded.Id}");
        var missing = await client.GetAsync("/api/requests/999999");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var request = await response.ReadAsAsync<RequestDto>();
        Assert.Equal(seeded.Title, request.Title);
        Assert.Equal(seeded.Organization, request.OrganizationName);
        Assert.Equal(seeded.Status, request.Status);
        Assert.Equal(seeded.Priority, request.Priority);
        Assert.Equal(seeded.AssignedTo, request.AssignedTo);
        Assert.Equal(seeded.CreatedAt, request.CreatedAt);
        Assert.Equal((await fixture.GetRequestAsync(seeded.Id)).Version, request.Version);   // the real row version

        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal("application/problem+json", missing.Content.Headers.ContentType?.MediaType);
    }
}
