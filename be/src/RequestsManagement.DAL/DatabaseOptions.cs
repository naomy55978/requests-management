namespace RequestsManagement.DAL;

/// <summary>
/// Startup database initialization (D-17, D-48). Bound from the "Database" configuration section.
/// All flags default to false; appsettings.Development.json turns them on so a reviewer gets
/// a ready, warm database on first run. Integration tests keep the seed and the warm-up off.
/// </summary>
public class DatabaseOptions
{
    public const string SectionName = "Database";

    /// <summary>Apply pending EF Core migrations when the application starts.</summary>
    public bool MigrateOnStartup { get; set; }

    /// <summary>Seed demo data on startup when the database is empty.</summary>
    public bool SeedOnStartup { get; set; }

    /// <summary>Number of requests created by the startup seed.</summary>
    public int SeedRequestCount { get; set; } = 100_000;

    /// <summary>
    /// Before the API starts listening, ask for the summary once (in the API project, which can use the BL): this
    /// warms a cold database and fills the summary cache, so the first request is fast (D-48). A separate flag
    /// because warming is not seeding. Off by default; on in Development.
    /// </summary>
    public bool WarmUpOnStartup { get; set; }
}
