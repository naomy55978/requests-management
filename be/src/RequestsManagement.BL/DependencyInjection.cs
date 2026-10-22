using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace RequestsManagement.BL;

public static class DependencyInjection
{
    /// <summary>Registers the business logic layer. Called only from the API composition root (Program.cs).</summary>
    public static IServiceCollection AddBusinessLogic(this IServiceCollection services)
    {
        // Scoped: services use the per-request repository and DbContext
        services.AddScoped<IRequestService, RequestService>();
        services.AddScoped<IAuthService, AuthService>();

        // Clock for UpdatedAt / ChangedAt and token times; replaceable in tests
        services.TryAddSingleton(TimeProvider.System);

        return services;
    }
}
