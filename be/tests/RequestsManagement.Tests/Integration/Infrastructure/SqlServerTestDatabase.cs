using Microsoft.Data.SqlClient;

namespace RequestsManagement.Tests.Integration.Infrastructure;

/// <summary>
/// A temporary database for one test run (D-09): created on a real SQL Server, dropped at the end.
/// It only ever creates and drops a database of its own (name prefix + random id), so it cannot damage
/// other databases on a shared instance.
/// </summary>
public sealed class SqlServerTestDatabase
{
    /// <summary>Environment variable with a connection string to the SQL Server (without a database name).</summary>
    public const string ConnectionVariable = "TESTS_SQL_CONNECTION";

    private const string NamePrefix = "RequestsManagement_Tests_";

    // Tried in this order when the variable is not set: a default instance, then LocalDB (D-17)
    private static readonly string[] LocalCandidates =
    [
        "Server=.;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=5",
        "Server=(localdb)\\MSSQLLocalDB;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=120"
    ];

    private string _serverConnectionString = "";

    public string DatabaseName { get; } = NamePrefix + Guid.NewGuid().ToString("N");

    /// <summary>Connection string of the temporary database (the one the API under test uses).</summary>
    public string ConnectionString =>
        new SqlConnectionStringBuilder(_serverConnectionString) { InitialCatalog = DatabaseName }.ConnectionString;

    public async Task CreateAsync()
    {
        _serverConnectionString = await ResolveServerAsync();
        await using var connection = new SqlConnection(_serverConnectionString);
        await connection.OpenAsync();
        await ExecuteAsync(connection, $"CREATE DATABASE [{DatabaseName}]");
    }

    public async Task DropAsync()
    {
        if (_serverConnectionString.Length == 0)
        {
            return; // never created
        }

        // The guard: only a database created by this class is ever dropped
        if (!DatabaseName.StartsWith(NamePrefix, StringComparison.Ordinal))
        {
            throw new InvalidOperationException($"Refusing to drop database '{DatabaseName}'.");
        }

        // Connections of the pool would keep the database busy
        SqlConnection.ClearAllPools();
        await using var connection = new SqlConnection(_serverConnectionString);
        await connection.OpenAsync();
        await ExecuteAsync(connection,
            $"IF DB_ID(N'{DatabaseName}') IS NOT NULL BEGIN " +
            $"ALTER DATABASE [{DatabaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{DatabaseName}]; END");
    }

    /// <summary>Runs a statement in the temporary database. Parameters are passed as (name, value) pairs.</summary>
    public async Task ExecuteAsync(string sql, params (string Name, object? Value)[] parameters)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = CreateCommand(connection, sql, parameters);
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>Runs a query in the temporary database and maps every row.</summary>
    public async Task<List<T>> QueryAsync<T>(
        string sql, Func<SqlDataReader, T> map, params (string Name, object? Value)[] parameters)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = CreateCommand(connection, sql, parameters);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<T>();
        while (await reader.ReadAsync())
        {
            rows.Add(map(reader));
        }

        return rows;
    }

    public async Task<T> ScalarAsync<T>(string sql, params (string Name, object? Value)[] parameters)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = CreateCommand(connection, sql, parameters);
        return (T)Convert.ChangeType((await command.ExecuteScalarAsync())!, typeof(T));
    }

    private static SqlCommand CreateCommand(SqlConnection connection, string sql, (string Name, object? Value)[] parameters)
    {
        var command = new SqlCommand(sql, connection) { CommandTimeout = 120 };
        foreach (var (name, value) in parameters)
        {
            command.Parameters.AddWithValue(name, value ?? DBNull.Value);
        }

        return command;
    }

    private static async Task ExecuteAsync(SqlConnection connection, string sql)
    {
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 120 };
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<string> ResolveServerAsync()
    {
        var fromEnvironment = Environment.GetEnvironmentVariable(ConnectionVariable);
        string[] candidates = string.IsNullOrWhiteSpace(fromEnvironment) ? LocalCandidates : [fromEnvironment];

        var failures = new List<string>();
        foreach (var candidate in candidates)
        {
            try
            {
                await using var connection = new SqlConnection(candidate);
                await connection.OpenAsync();
                return candidate;
            }
            catch (Exception exception) when (exception is SqlException or InvalidOperationException or ArgumentException)
            {
                failures.Add($"  {new SqlConnectionStringBuilder(candidate) { Password = "", UserID = "" }.DataSource}: {exception.Message}");
            }
        }

        throw new InvalidOperationException(
            "No SQL Server is available for the integration tests. Set the environment variable " +
            $"{ConnectionVariable} to a connection string of a SQL Server (without a database name), " +
            "for example \"Server=.;Trusted_Connection=True;TrustServerCertificate=True\". Tried:\n" +
            string.Join('\n', failures));
    }
}
