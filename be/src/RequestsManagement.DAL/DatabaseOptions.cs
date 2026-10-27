namespace RequestsManagement.DAL;

/// <summary>
/// Startup database initialization (D-17). Bound from the "Database" configuration section.
/// Both flags default to false; appsettings.Development.json turns them on so a reviewer gets a ready database on first run.
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
}
