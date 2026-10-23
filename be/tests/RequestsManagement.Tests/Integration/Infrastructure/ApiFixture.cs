using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using RequestsManagement.DTO;
using RequestsManagement.DTO.Enums;

namespace RequestsManagement.Tests.Integration.Infrastructure;

/// <summary>
/// Everything the integration tests share, created once per test run: the temporary database (created from the
/// migrations by the API itself, then filled with the fixed data), the API, and one token per demo user.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public const string DefaultUser = "dana.cohen";

    /// <summary>JSON as the API writes it: camelCase, enums as names.</summary>
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly Dictionary<string, string> _tokens = [];

    public SqlServerTestDatabase Database { get; } = new();

    public ApiFactory Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await Database.CreateAsync();
        Factory = new ApiFactory(Database.ConnectionString);

        // Creating the first client starts the API, which applies the migrations to the empty database
        using (Factory.CreateClient())
        {
        }

        await SeedAsync();

        foreach (var (userName, _) in TestData.Users)
        {
            using var anonymous = Factory.CreateClient();
            var response = await anonymous.PostAsJsonAsync(
                "/api/auth/login", new { userName, password = TestData.DemoPassword });
            response.EnsureSuccessStatusCode();
            _tokens[userName] = (await response.Content.ReadFromJsonAsync<LoginResponse>(Json))!.AccessToken;
        }
    }

    public async Task DisposeAsync()
    {
        Factory?.Dispose();
        await Database.DropAsync();
    }

    /// <summary>A client of the API. Without a user name it sends no token.</summary>
    public HttpClient Client(string? userName = DefaultUser)
    {
        var client = Factory.CreateClient();
        if (userName is not null)
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _tokens[userName]);
        }

        return client;
    }

    public static Task<HttpResponseMessage> PatchStatusAsync(HttpClient client, int id, RequestStatus status, string version) =>
        client.PatchAsJsonAsync($"/api/requests/{id}/status", new { newStatus = status.ToString(), version });

    public static Task<HttpResponseMessage> BulkAsync(
        HttpClient client, RequestStatus status, IEnumerable<(int Id, string Version)> items) =>
        client.PostAsJsonAsync("/api/requests/bulk-status", new
        {
            newStatus = status.ToString(),
            items = items.Select(item => new { id = item.Id, version = item.Version }).ToArray()
        });

    /// <summary>
    /// Adds a request that belongs to one test (created in 2030, so the read tests never see it).
    /// Its version is the real one from the database.
    /// </summary>
    public async Task<NewRequest> InsertRequestAsync(
        RequestStatus status = RequestStatus.New,
        RequestPriority priority = RequestPriority.Medium,
        string organization = "Scratch Org",
        string? assignedTo = null)
    {
        var rows = await Database.QueryAsync(
            """
            INSERT INTO [Requests] ([Title], [OrganizationName], [Status], [Priority], [AssignedTo], [CreatedAt], [UpdatedAt])
            OUTPUT inserted.[Id], inserted.[RowVersion]
            VALUES (@title, @organization, @status, @priority, @assignedTo, @createdAt, @createdAt)
            """,
            reader => new NewRequest(reader.GetInt32(0), Convert.ToBase64String((byte[])reader[1])),
            ("@title", $"Scratch request {Guid.NewGuid():N}"),
            ("@organization", organization),
            ("@status", (byte)status),
            ("@priority", (byte)priority),
            ("@assignedTo", assignedTo),
            ("@createdAt", TestData.ScratchCreatedAt));
        return rows.Single();
    }

    /// <summary>Adds several requests of one test in the same state.</summary>
    public async Task<List<NewRequest>> InsertRequestsAsync(int count, RequestStatus status = RequestStatus.New)
    {
        var requests = new List<NewRequest>(count);
        for (var i = 0; i < count; i++)
        {
            requests.Add(await InsertRequestAsync(status));
        }

        return requests;
    }

    /// <summary>The request as the database holds it (read with SQL, not through the API).</summary>
    public async Task<DbRequest> GetRequestAsync(int id)
    {
        var rows = await Database.QueryAsync(
            "SELECT [Status], [Priority], [UpdatedAt], [RowVersion] FROM [Requests] WHERE [Id] = @id",
            reader => new DbRequest(
                id,
                (RequestStatus)reader.GetByte(0),
                (RequestPriority)reader.GetByte(1),
                DateTime.SpecifyKind(reader.GetDateTime(2), DateTimeKind.Utc),
                Convert.ToBase64String((byte[])reader[3])),
            ("@id", id));
        return rows.Single();
    }

    /// <summary>The audit rows of a request, in the order they were written.</summary>
    public Task<List<DbHistoryRow>> GetHistoryAsync(int id) => Database.QueryAsync(
        "SELECT [PreviousStatus], [NewStatus], [ChangedAt], [ChangedBy] FROM [RequestStatusHistory] WHERE [RequestId] = @id ORDER BY [Id]",
        reader => new DbHistoryRow(
            (RequestStatus)reader.GetByte(0),
            (RequestStatus)reader.GetByte(1),
            DateTime.SpecifyKind(reader.GetDateTime(2), DateTimeKind.Utc),
            reader.GetString(3)),
        ("@id", id));

    /// <summary>The summary as the database itself calculates it (the answer the API must give).</summary>
    public async Task<SummaryDto> GetSummaryTruthAsync()
    {
        var byStatus = await Database.QueryAsync(
            "SELECT [Status], COUNT(*) FROM [Requests] GROUP BY [Status]",
            reader => (Status: (RequestStatus)reader.GetByte(0), Count: reader.GetInt32(1)));
        var byPriority = await Database.QueryAsync(
            "SELECT [Priority], COUNT(*) FROM [Requests] GROUP BY [Priority]",
            reader => (Priority: (RequestPriority)reader.GetByte(0), Count: reader.GetInt32(1)));
        var organizations = await Database.QueryAsync(
            """
            SELECT TOP 10 [OrganizationName], COUNT(*) AS [Open] FROM [Requests] WHERE [Status] <> 4
            GROUP BY [OrganizationName] ORDER BY [Open] DESC, [OrganizationName]
            """,
            reader => new OrganizationCountDto(reader.GetString(0), reader.GetInt32(1)));

        return new SummaryDto(
            byStatus.Sum(s => s.Count),
            Enum.GetValues<RequestStatus>().Select(s => new StatusCountDto(s, byStatus.FirstOrDefault(c => c.Status == s).Count)).ToList(),
            Enum.GetValues<RequestPriority>().Select(p => new PriorityCountDto(p, byPriority.FirstOrDefault(c => c.Priority == p).Count)).ToList(),
            organizations);
    }

    private async Task SeedAsync()
    {
        var hasher = new PasswordHasher<object>();
        foreach (var (userName, displayName) in TestData.Users)
        {
            await Database.ExecuteAsync(
                "INSERT INTO [Users] ([UserName], [DisplayName], [PasswordHash]) VALUES (@userName, @displayName, @hash)",
                ("@userName", userName), ("@displayName", displayName),
                ("@hash", hasher.HashPassword(new object(), TestData.DemoPassword)));
        }

        foreach (var request in TestData.Requests)
        {
            // Fixed ids: the tests refer to the rows of the oracle list by id
            await Database.ExecuteAsync(
                """
                SET IDENTITY_INSERT [Requests] ON;
                INSERT INTO [Requests] ([Id], [Title], [OrganizationName], [Status], [Priority], [AssignedTo], [CreatedAt], [UpdatedAt])
                VALUES (@id, @title, @organization, @status, @priority, @assignedTo, @createdAt, @updatedAt);
                SET IDENTITY_INSERT [Requests] OFF;
                """,
                ("@id", request.Id), ("@title", request.Title), ("@organization", request.Organization),
                ("@status", (byte)request.Status), ("@priority", (byte)request.Priority),
                ("@assignedTo", request.AssignedTo), ("@createdAt", request.CreatedAt), ("@updatedAt", request.UpdatedAt));
        }
    }
}

/// <summary>A request added by a test: its id and its current version.</summary>
public sealed record NewRequest(int Id, string Version);

public sealed record DbRequest(int Id, RequestStatus Status, RequestPriority Priority, DateTime UpdatedAt, string Version);

public sealed record DbHistoryRow(RequestStatus PreviousStatus, RequestStatus NewStatus, DateTime ChangedAt, string ChangedBy);

/// <summary>One xUnit collection for all integration tests, so they share the single fixture above.</summary>
[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "Api";
}

internal static class HttpResponseExtensions
{
    public static async Task<T> ReadAsAsync<T>(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(ApiFixture.Json))!;

    /// <summary>The body of an error response (ProblemDetails / ValidationProblemDetails) as JSON.</summary>
    public static async Task<JsonElement> ReadProblemAsync(this HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }
}
