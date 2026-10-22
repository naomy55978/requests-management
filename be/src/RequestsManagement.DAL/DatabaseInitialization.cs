using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RequestsManagement.DAL.Seeding;

namespace RequestsManagement.DAL;

/// <summary>
/// Database setup entry points for the API composition root: startup initialization (D-17)
/// and the "seed" command line mode.
/// </summary>
public static class DatabaseInitialization
{
    /// <summary>
    /// Applies migrations and seeds an empty database, according to <see cref="DatabaseOptions"/>.
    /// Gives a reviewer a ready database on first run without manual steps.
    /// </summary>
    public static async Task InitializeDatabaseAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        var options = services.GetRequiredService<DatabaseOptions>();
        if (!options.MigrateOnStartup && !options.SeedOnStartup)
        {
            return;
        }

        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(DatabaseInitialization));

        if (options.MigrateOnStartup)
        {
            logger.LogInformation("Applying database migrations");
            await db.Database.MigrateAsync(cancellationToken);
        }

        if (options.SeedOnStartup)
        {
            var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();
            if (await seeder.IsEmptyAsync(cancellationToken))
            {
                logger.LogInformation("Database is empty – seeding {Count} demo requests", options.SeedRequestCount);
                await seeder.SeedAsync(options.SeedRequestCount, cancellationToken);
            }
            else
            {
                logger.LogInformation("Database already contains data – startup seed skipped");
            }
        }
    }

    /// <summary>
    /// Seeds the database on demand. With <paramref name="reset"/> the database is dropped and re-created first;
    /// without it, seeding is refused when the database already contains data.
    /// </summary>
    /// <exception cref="DatabaseSeedException">Seeding was refused.</exception>
    public static async Task SeedDatabaseAsync(
        this IServiceProvider services, int requestCount, bool reset, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();

        if (reset)
        {
            await seeder.ResetAsync(cancellationToken);
        }
        else
        {
            await db.Database.MigrateAsync(cancellationToken);
            if (!await seeder.IsEmptyAsync(cancellationToken))
            {
                throw new DatabaseSeedException(
                    "The database already contains data. Run the seed with --reset to drop and re-create it.");
            }
        }

        await seeder.SeedAsync(requestCount, cancellationToken);
    }
}
