using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using RequestsManagement.DTO;
using RequestsManagement.Tests.Integration.Infrastructure;

namespace RequestsManagement.Tests.Integration;

/// <summary>Every endpoint except login needs a valid token (D-10, secure by default).</summary>
[Collection(ApiCollection.Name)]
public class AuthenticationTests(ApiFixture fixture)
{
    [Theory]
    [InlineData("GET", "/api/requests")]
    [InlineData("GET", "/api/requests/1")]
    [InlineData("GET", "/api/requests/summary")]
    [InlineData("GET", "/api/requests/1/history")]
    [InlineData("PATCH", "/api/requests/1/status")]
    [InlineData("POST", "/api/requests/bulk-status")]
    public async Task Endpoints_WithoutToken_AreRejectedWith401(string method, string path)
    {
        using var client = fixture.Client(userName: null);
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        if (method != "GET")
        {
            request.Content = JsonContent.Create(new { });
        }

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.True((await response.ReadProblemAsync()).TryGetProperty("traceId", out _));
    }

    [Fact]
    public async Task Endpoint_WithInvalidToken_IsRejectedWith401()
    {
        using var client = fixture.Client(userName: null);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not.a.valid-token");

        var response = await client.GetAsync("/api/requests/summary");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithCorrectPassword_ReturnsAToken()
    {
        using var client = fixture.Client(userName: null);

        var response = await client.PostAsJsonAsync(
            "/api/auth/login", new { userName = "yossi.friedman", password = TestData.DemoPassword });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = await response.ReadAsAsync<LoginResponse>();
        Assert.Equal("yossi.friedman", login.UserName);
        Assert.False(string.IsNullOrWhiteSpace(login.AccessToken));
    }

    [Fact]
    public async Task Login_WithWrongPasswordOrUnknownUser_GivesTheSameAnswer()
    {
        // The answer must not reveal which user names exist
        using var client = fixture.Client(userName: null);

        var wrongPassword = await client.PostAsJsonAsync(
            "/api/auth/login", new { userName = "dana.cohen", password = "wrong-password" });
        var unknownUser = await client.PostAsJsonAsync(
            "/api/auth/login", new { userName = "nobody", password = "wrong-password" });

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownUser.StatusCode);
        var first = await wrongPassword.ReadProblemAsync();
        var second = await unknownUser.ReadProblemAsync();
        Assert.Equal(first.GetProperty("title").GetString(), second.GetProperty("title").GetString());
        Assert.Equal(
            first.TryGetProperty("detail", out var d1) ? d1.GetString() : null,
            second.TryGetProperty("detail", out var d2) ? d2.GetString() : null);
    }
}
