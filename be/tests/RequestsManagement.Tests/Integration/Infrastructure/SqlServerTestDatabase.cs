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

    /// <summary>
    /// The server when <see cref="ConnectionVariable"/> is not set: LocalDB. Any other server (including a local
    /// default instance) is used only when the variable names it, so a machine's own instance is never tried by chance.
    /// </summary>
    public const string DefaultServer =
        "Server=(localdb)\\MSSQLLocalDB;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=120";

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

    /// <summary>The server named by the variable when it is set, otherwise <see cref="DefaultServer"/> (no fallback chain).</summary>
    internal static string ResolveServer(string? fromEnvironment) =>
        string.IsNullOrWhiteSpace(fromEnvironment) ? DefaultServer : fromEnvironment;

    /// <summary>Connects to the chosen server once, failing with a message that says which server was tried and how to choose another.</summary>
    private static async Task<string> ResolveServerAsync()
    {
        var fromEnvironment = Environment.GetEnvironmentVariable(ConnectionVariable);
        var server = ResolveServer(fromEnvironment);
        try
        {
            await using var connection = new SqlConnection(server);
            await connection.OpenAsync();
            return server;
        }
        catch (Exception exception) when (exception is SqlException or InvalidOperationException or ArgumentException)
        {
            var tried = string.IsNullOrWhiteSpace(fromEnvironment)
                ? "LocalDB, the default"
                : $"{new SqlConnectionStringBuilder(server) { Password = "", UserID = "" }.DataSource}, from {ConnectionVariable}";
            throw new InvalidOperationException(
                $"The integration tests could not connect to SQL Server ({tried}): {exception.Message}\n" +
                $"Install SQL Server LocalDB, or set {ConnectionVariable} to a connection string of a SQL Server " +
                "(without a database name) where you may create databases, for example " +
                "\"Server=.;Trusted_Connection=True;TrustServerCertificate=True\".",
                exception);
        }
    }
}
