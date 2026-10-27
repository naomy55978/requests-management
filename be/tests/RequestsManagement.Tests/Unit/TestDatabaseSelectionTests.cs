using RequestsManagement.Tests.Integration.Infrastructure;

namespace RequestsManagement.Tests.Unit;

/// <summary>
/// Which SQL Server the integration tests use: LocalDB unless TESTS_SQL_CONNECTION names another one. A machine's own
/// default instance is never tried by chance, where the tests may lack the right to create a database.
/// </summary>
public class TestDatabaseSelectionTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void WithoutTheVariable_LocalDbIsUsed(string? fromEnvironment)
    {
        Assert.Equal(SqlServerTestDatabase.DefaultServer, SqlServerTestDatabase.ResolveServer(fromEnvironment));
        Assert.Contains("(localdb)", SqlServerTestDatabase.DefaultServer);
    }

    [Fact]
    public void WithTheVariable_ExactlyThatServerIsUsed()
    {
        const string server = "Server=.;Trusted_Connection=True;TrustServerCertificate=True";

        Assert.Equal(server, SqlServerTestDatabase.ResolveServer(server));
    }
}
