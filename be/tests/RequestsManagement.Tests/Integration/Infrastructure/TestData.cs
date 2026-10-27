using RequestsManagement.DTO.Enums;

namespace RequestsManagement.Tests.Integration.Infrastructure;

/// <summary>A request of the fixed test data. The same list is written to the database and used as the oracle.</summary>
public sealed record SeedRequest(
    int Id,
    string Title,
    string Organization,
    RequestStatus Status,
    RequestPriority Priority,
    string? AssignedTo,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>
/// The small fixed data set of the integration tests (D-09; not the 100K demo seed). The expected result of every
/// read test is calculated from this list with LINQ, so no expected value is copied by hand.
/// </summary>
/// <remarks>
/// Read tests only look at requests created in <see cref="Window"/>. Tests that change data add their own requests
/// (created in 2030), so they never disturb a read test, whatever the order. Titles are plain ASCII with the
/// first letters different, so ordering is the same in every collation (local server and CI container).
/// </remarks>
public static class TestData
{
    public const string DemoPassword = "Demo123!";

    public static readonly (string UserName, string DisplayName)[] Users =
    [
        ("dana.cohen", "Dana Cohen"),
        ("yossi.friedman", "Yossi Friedman"),
        ("maya.levi", "Maya Levi")
    ];

    /// <summary>Query-string part that limits a list request to the fixed data (everything else is created later).</summary>
    public const string Window = "createdFrom=2026-01-01&createdTo=2026-12-31";

    /// <summary>Creation date of requests added by tests: outside <see cref="Window"/>.</summary>
    public static readonly DateTime ScratchCreatedAt = new(2030, 1, 1, 8, 0, 0, DateTimeKind.Utc);

    private static readonly DateTime Start = new(2026, 1, 1, 8, 0, 0, DateTimeKind.Utc);
    private static readonly string[] Topics = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
    private static readonly string[] Organizations = ["Acme Ltd", "Beta Corp", "Cobalt Inc", "Delta Group"];

    public static IReadOnlyList<SeedRequest> Requests { get; } = Build();

    private static List<SeedRequest> Build()
    {
        var requests = new List<SeedRequest>();
        for (var i = 1; i <= 40; i++)
        {
            // Three titles contain the characters that are special in a LIKE pattern: they must be found literally
            var title = i switch
            {
                7 => "Fox 50% discount",
                14 => "Golf under_score",
                21 => "Hotel [bracket] note",
                _ => $"Request {i:00} {Topics[i % Topics.Length]}"
            };

            var created = Start.AddDays(i);
            requests.Add(new SeedRequest(
                i,
                title,
                Organizations[i % Organizations.Length],
                (RequestStatus)(i % 4 + 1),
                (RequestPriority)(i % 3 + 1),
                i % 5 == 0 ? null : Users[i % Users.Length].UserName,
                created,
                created.AddHours(i % 7)));
        }

        return requests;
    }
}
