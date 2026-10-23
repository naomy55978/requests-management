using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;

namespace RequestsManagement.Tests.Integration.Infrastructure;

/// <summary>
/// The real API in memory, connected to the temporary database. Only configuration is replaced, no service:
/// the tests run the same code and the same DI registrations as the real application.
/// </summary>
/// <remarks>The Server-Timing header (D-25) is on, as in Development; a test can start an instance without it.</remarks>
public sealed class ApiFactory(string connectionString, bool serverTiming = true) : WebApplicationFactory<Program>
{
    // A signing key for the tests only (the real ones are never in a repository). At least 32 bytes.
    private const string TestSigningKey = "tests-only-signing-key-0123456789-abcdefghijklmnop";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Not "Development": no appsettings.Development.json, so no demo seed and no development key
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:RequestsDb", connectionString);
        builder.UseSetting("Database:MigrateOnStartup", "true");   // the schema comes from the real migrations
        builder.UseSetting("Database:SeedOnStartup", "false");     // the tests write their own small data set
        builder.UseSetting("Jwt:SigningKey", TestSigningKey);
        builder.UseSetting("ServerTiming:Enabled", serverTiming ? "true" : "false");

        // Failures are visible, the per-request information lines are not
        builder.ConfigureLogging(logging => logging.SetMinimumLevel(LogLevel.Warning));
    }
}
