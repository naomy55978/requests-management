using System.Net;
using System.Text;
using System.Text.Json;
using RequestsManagement.Tests.Integration.Infrastructure;

namespace RequestsManagement.Tests.Integration;

/// <summary>
/// The 400 contract for bodies the serializer cannot read: plain field names as keys (never a JSON path like
/// "$.newStatus") and messages without .NET type names. Validation runs before the action, so no request is touched.
/// </summary>
[Collection(ApiCollection.Name)]
public class ValidationErrorTests(ApiFixture fixture)
{
    private const string Patch = "/api/requests/999999/status";
    private const string Bulk = "/api/requests/bulk-status";
    private const string Login = "/api/auth/login";
    private const string Version = "AAAAAAAAB9E=";

    public static TheoryData<string, string, string, string> UnreadableBodies() => new()
    {
        { Patch, $$"""{"newStatus":"Nope","version":"{{Version}}"}""", "newStatus", "The value of 'newStatus' is not valid." },
        { Patch, """{"newStatus":"InProgress","version":5}""", "version", "The value of 'version' is not valid." },
        { Patch, $$"""{"newStatus":"InProgress","version":"{{Version}}","changedBy":"x"}""", "changedBy", "'changedBy' is not a known field." },
        { Patch, """{"newStatus":"InProgress","version":""", "body", "The request body is not valid JSON." },
        { Patch, "", "body", "A non-empty request body is required." },
        { Patch, "[]", "body", "The request body must be a JSON object." },
        { Bulk, $$"""{"newStatus":"InProgress","items":[{"id":"x","version":"{{Version}}"}]}""", "items[0].id", "The value of 'items[0].id' is not valid." },
        { Bulk, $$"""{"newStatus":"InProgress","items":[{"id":1,"version":"{{Version}}","foo":1}]}""", "items[0].foo", "'items[0].foo' is not a known field." },
        { Bulk, """{"newStatus":"InProgress","items":5}""", "items", "The value of 'items' is not valid." },
        { Login, """{"userName":5,"password":"x"}""", "userName", "The value of 'userName' is not valid." }
    };

    [Theory]
    [MemberData(nameof(UnreadableBodies))]
    public async Task UnreadableBody_Gives400WithAPlainFieldKeyAndAReadableMessage(
        string url, string json, string expectedKey, string expectedMessage)
    {
        using var client = fixture.Client();
        using var body = new StringContent(json, Encoding.UTF8, "application/json");

        var response = url == Patch ? await client.PatchAsync(url, body) : await client.PostAsync(url, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.ReadProblemAsync();
        Assert.True(problem.TryGetProperty("traceId", out _));
        var error = Assert.Single(problem.GetProperty("errors").EnumerateObject());
        Assert.Equal(expectedKey, error.Name);
        Assert.Equal(expectedMessage, Assert.Single(error.Value.EnumerateArray()).GetString());
        AssertNoInternals(problem);
    }

    public static TheoryData<string> ItemCountsOutsideTheLimit() => new()
    {
        BulkBody(itemCount: 101),
        """{"newStatus":"InProgress","items":[]}""",
        """{"newStatus":"InProgress","items":null}"""
    };

    private static string BulkBody(int itemCount)
    {
        var items = Enumerable.Range(1, itemCount).Select(id => $$"""{"id":{{id}},"version":"{{Version}}"}""");
        return $$"""{"newStatus":"InProgress","items":[{{string.Join(",", items)}}]}""";
    }

    // The count rule of a Bulk call (1 to 100) is answered like every other 400: key "items" and the API's own message,
    // not the DataAnnotations default that names the .NET property ("The field Items must be ...")
    [Theory]
    [MemberData(nameof(ItemCountsOutsideTheLimit))]
    public async Task BulkItemCountOutsideOneToHundred_Gives400WithAPlainKeyAndTheApiMessage(string json)
    {
        using var client = fixture.Client();
        using var body = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await client.PostAsync(Bulk, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.True(problem.TryGetProperty("traceId", out _));
        var error = Assert.Single(problem.GetProperty("errors").EnumerateObject());
        Assert.Equal("items", error.Name);
        Assert.Equal("'items' must have 1 to 100 requests.", Assert.Single(error.Value.EnumerateArray()).GetString());
        AssertNoInternals(problem);
    }

    // Also a body with several problems: every key is a field name and nothing names a .NET type
    [Fact]
    public async Task SeveralProblems_AllKeysArePlainFieldNames()
    {
        using var client = fixture.Client();
        using var body = new StringContent(
            """{"newStatus":"InProgress","items":[null,{"id":0,"version":""},{"id":2,"version":"***"}]}""",
            Encoding.UTF8, "application/json");

        var response = await client.PostAsync(Bulk, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        var keys = problem.GetProperty("errors").EnumerateObject().Select(e => e.Name).Order().ToArray();
        Assert.Equal(["items[0]", "items[1].id", "items[1].version", "items[2].version"], keys);
        AssertNoInternals(problem);
    }

    private static void AssertNoInternals(JsonElement problem)
    {
        foreach (var error in problem.GetProperty("errors").EnumerateObject())
        {
            Assert.False(error.Name.StartsWith('$'), $"key '{error.Name}' is a JSON path");
            foreach (var message in error.Value.EnumerateArray().Select(m => m.GetString()!))
            {
                foreach (var internalText in new[] { "System.", "RequestsManagement.", "LineNumber", "Path:", ".NET" })
                {
                    Assert.DoesNotContain(internalText, message);
                }
            }
        }
    }
}
