using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace RequestsManagement.DAL;

public static class DependencyInjection
{
    /// <summary>
    /// Registers the data access layer. Called only from the API composition root (Program.cs).
    /// </summary>
    public static IServiceCollection AddDataAccess(
        this IServiceCollection services, string connectionString, DatabaseOptions databaseOptions)
    {
        // AddDbContext registers the context as Scoped – one instance per HTTP request
        services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));
        services.AddSingleton(databaseOptions);

        return services;
    }
}
