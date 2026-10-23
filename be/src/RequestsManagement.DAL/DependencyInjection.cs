using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RequestsManagement.DAL.Seeding;
using RequestsManagement.DTO.Diagnostics;

namespace RequestsManagement.DAL;

public static class DependencyInjection
{
    /// <summary>
    /// Registers the data access layer. Called only from the API composition root (Program.cs).
    /// </summary>
    public static IServiceCollection AddDataAccess(
        this IServiceCollection services, string connectionString, DatabaseOptions databaseOptions)
    {
        // AddDbContext registers the context as Scoped – one instance per HTTP request.
        // The interceptor adds every command's duration to the request's timings (Server-Timing, D-25);
        // the options are built per scope, so it gets the RequestTimings of the same request.
        services.AddScoped<RequestTimings>();
        services.AddDbContext<AppDbContext>((provider, options) => options
            .UseSqlServer(connectionString)
            .AddInterceptors(new DbTimingInterceptor(provider.GetRequiredService<RequestTimings>())));
        services.AddSingleton(databaseOptions);
        services.AddScoped<DatabaseSeeder>();
        services.AddScoped<IRequestRepository, RequestRepository>();
        services.AddScoped<IUserRepository, UserRepository>();

        return services;
    }
}
