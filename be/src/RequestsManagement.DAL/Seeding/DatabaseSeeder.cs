using System.Data;
using System.Diagnostics;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RequestsManagement.DAL.Entities;

namespace RequestsManagement.DAL.Seeding;

/// <summary>Raised when seeding is refused (e.g. the database is not empty or not safe to reset).</summary>
public class DatabaseSeedException(string message) : Exception(message);

/// <summary>
/// Writes the generated demo data with SqlBulkCopy (D-13) – tens of times faster than inserting through EF.
/// </summary>
internal sealed class DatabaseSeeder(AppDbContext db, ILogger<DatabaseSeeder> logger)
{
    /// <summary>
    /// Reset drops the whole database, so it is allowed only when the connection string points to
    /// exactly this database name. Protects other databases on a shared SQL Server instance.
    /// </summary>
    public const string ResettableDatabaseName = "RequestsManagement";

    private const int BatchSize = 10_000;

    /// <summary>True when the database has no users and no requests, so seeding never mixes with existing data.</summary>
    public async Task<bool> IsEmptyAsync(CancellationToken cancellationToken) =>
        !await db.Users.AnyAsync(cancellationToken) && !await db.Requests.AnyAsync(cancellationToken);

    /// <summary>Drops the database and re-creates it from the migrations, so identity values restart at 1.</summary>
    public async Task ResetAsync(CancellationToken cancellationToken)
    {
        var databaseName = new SqlConnectionStringBuilder(db.Database.GetConnectionString()).InitialCatalog;
        if (!string.Equals(databaseName, ResettableDatabaseName, StringComparison.Ordinal))
        {
            throw new DatabaseSeedException(
                $"Refusing to reset database '{databaseName}': --reset drops the whole database and is allowed " +
                $"only when the connection string targets the database '{ResettableDatabaseName}'.");
        }

        logger.LogWarning("Dropping and re-creating database {Database}", databaseName);
        await db.Database.EnsureDeletedAsync(cancellationToken);
        await db.Database.MigrateAsync(cancellationToken);
    }

    /// <summary>Generates the demo data, writes it with bulk copy in one transaction and then rebuilds the indexes.</summary>
    public async Task SeedAsync(int requestCount, CancellationToken cancellationToken)
    {
        // On a cold SQL Server (e.g. the first LocalDB start) this took over two minutes - tell the user to wait
        logger.LogInformation(
            "Seeding {Count:N0} requests - this may take a few minutes on first run", requestCount);

        var stopwatch = Stopwatch.StartNew();
        var data = SeedDataGenerator.Generate(requestCount);

        // Each user gets its own random salt, so the hashes differ between runs (all other data is identical)
        var passwordHasher = new PasswordHasher<User>();
        foreach (var user in data.Users)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, SeedDataGenerator.DemoPassword);
        }

        logger.LogInformation(
            "Generated {Users} users, {Requests} requests and {History} history rows in {Elapsed} ms",
            data.Users.Count, data.Requests.Count, data.History.Count, stopwatch.ElapsedMilliseconds);

        var connection = (SqlConnection)db.Database.GetDbConnection();
        await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            // One transaction: either all demo data is written or none of it
            await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

            await BulkCopyAsync(connection, transaction, "Users", ToDataTable(data.Users), cancellationToken);
            await BulkCopyAsync(connection, transaction, "Requests", ToDataTable(data.Requests), cancellationToken);
            await BulkCopyAsync(connection, transaction, "RequestStatusHistory", ToDataTable(data.History), cancellationToken);

            await transaction.CommitAsync(cancellationToken);
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }

        await RebuildIndexesAsync(cancellationToken);

        logger.LogInformation("Seeded {Requests} requests in {Elapsed} ms", data.Requests.Count, stopwatch.ElapsedMilliseconds);
    }

    // Bulk copy into tables that already have their nonclustered indexes leaves those indexes only 35-61% full
    // (page splits), so every query reads up to ~3x more pages than necessary (measured in M8,
    // docs/PERFORMANCE.md). A rebuild of our own tables compacts them in a few seconds.
    private async Task RebuildIndexesAsync(CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        await db.Database.ExecuteSqlRawAsync("ALTER INDEX ALL ON [dbo].[Requests] REBUILD", cancellationToken);
        await db.Database.ExecuteSqlRawAsync("ALTER INDEX ALL ON [dbo].[RequestStatusHistory] REBUILD", cancellationToken);

        logger.LogInformation("Rebuilt the indexes of Requests and RequestStatusHistory in {Elapsed} ms", stopwatch.ElapsedMilliseconds);
    }

    /// <summary>Writes one table's rows with SqlBulkCopy, keeping the generated Ids and checking the constraints.</summary>
    private async Task BulkCopyAsync(
        SqlConnection connection, SqlTransaction transaction, string table, DataTable rows, CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();

        // KeepIdentity: the generator assigns the Ids, so history rows can reference their requests.
        // CheckConstraints: validate CHECK and FK constraints (bulk copy skips them by default,
        // which would leave the constraints marked as untrusted).
        using var bulkCopy = new SqlBulkCopy(
            connection,
            SqlBulkCopyOptions.KeepIdentity | SqlBulkCopyOptions.TableLock | SqlBulkCopyOptions.CheckConstraints,
            transaction)
        {
            DestinationTableName = $"[dbo].[{table}]",
            BatchSize = BatchSize,
            BulkCopyTimeout = 300
        };

        foreach (DataColumn column in rows.Columns)
        {
            bulkCopy.ColumnMappings.Add(column.ColumnName, column.ColumnName);
        }

        await bulkCopy.WriteToServerAsync(rows, cancellationToken);
        logger.LogInformation("Bulk copied {Rows} rows into {Table} in {Elapsed} ms", rows.Rows.Count, table, stopwatch.ElapsedMilliseconds);
    }

    /// <summary>The users as a DataTable whose columns match the Users table, for bulk copy.</summary>
    private static DataTable ToDataTable(IReadOnlyList<User> users)
    {
        var table = new DataTable();
        table.Columns.Add(nameof(User.Id), typeof(int));
        table.Columns.Add(nameof(User.UserName), typeof(string));
        table.Columns.Add(nameof(User.DisplayName), typeof(string));
        table.Columns.Add(nameof(User.PasswordHash), typeof(string));

        foreach (var u in users)
        {
            table.Rows.Add(u.Id, u.UserName, u.DisplayName, u.PasswordHash);
        }
        return table;
    }

    // RowVersion is not mapped: SQL Server generates it
    private static DataTable ToDataTable(IReadOnlyList<Request> requests)
    {
        var table = new DataTable();
        table.Columns.Add(nameof(Request.Id), typeof(int));
        table.Columns.Add(nameof(Request.Title), typeof(string));
        table.Columns.Add(nameof(Request.OrganizationName), typeof(string));
        table.Columns.Add(nameof(Request.Status), typeof(byte));
        table.Columns.Add(nameof(Request.Priority), typeof(byte));
        table.Columns.Add(nameof(Request.AssignedTo), typeof(string));
        table.Columns.Add(nameof(Request.CreatedAt), typeof(DateTime));
        table.Columns.Add(nameof(Request.UpdatedAt), typeof(DateTime));

        foreach (var r in requests)
        {
            table.Rows.Add(r.Id, r.Title, r.OrganizationName, (byte)r.Status, (byte)r.Priority,
                (object?)r.AssignedTo ?? DBNull.Value, r.CreatedAt, r.UpdatedAt);
        }
        return table;
    }

    /// <summary>The history rows as a DataTable whose columns match the RequestStatusHistory table, for bulk copy.</summary>
    private static DataTable ToDataTable(IReadOnlyList<RequestStatusHistory> history)
    {
        var table = new DataTable();
        table.Columns.Add(nameof(RequestStatusHistory.Id), typeof(int));
        table.Columns.Add(nameof(RequestStatusHistory.RequestId), typeof(int));
        table.Columns.Add(nameof(RequestStatusHistory.PreviousStatus), typeof(byte));
        table.Columns.Add(nameof(RequestStatusHistory.NewStatus), typeof(byte));
        table.Columns.Add(nameof(RequestStatusHistory.ChangedAt), typeof(DateTime));
        table.Columns.Add(nameof(RequestStatusHistory.ChangedBy), typeof(string));

        foreach (var h in history)
        {
            table.Rows.Add(h.Id, h.RequestId, (byte)h.PreviousStatus, (byte)h.NewStatus, h.ChangedAt, h.ChangedBy);
        }
        return table;
    }
}
