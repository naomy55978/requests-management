using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using RequestsManagement.API.Auth;
using RequestsManagement.API.Commands;
using RequestsManagement.API.Middleware;
using RequestsManagement.API.Startup;
using RequestsManagement.BL;
using RequestsManagement.DAL;

// In "seed" mode the arguments belong to the seed command, not to the configuration system
var isSeedCommand = SeedCommand.IsInvoked(args);
var builder = WebApplication.CreateBuilder(isSeedCommand ? [] : args);

// Add services to the container.

// Required fields are declared explicitly on the DTOs ([Required], D-18). Without this switch every
// non-nullable parameter is also implicitly required, which adds a misleading "The request field is
// required." next to the real error when a body cannot be read (malformed JSON, unknown field).
builder.Services.AddControllers(options => options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true)
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        // Keys of validation errors follow the property names: "pageSize", not "PageSize"
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
        // A body field the API does not know is rejected with 400 instead of being ignored silently –
        // e.g. a client that tries to send "changedBy" is told so (the acting user comes only from the token)
        options.JsonSerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
    });
// Enums travel as readable strings ("InProgress"); numbers are still accepted as input.
// The OpenAPI schema generator reads these options, not the MVC ones.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi(options =>
{
    options.AddOperationTransformer((operation, _, _) =>
    {
        // Query binding ignores case; document the camelCase names the API contract uses (pageSize, sortBy, ...)
        foreach (var parameter in operation.Parameters?.OfType<OpenApiParameter>() ?? [])
        {
            if (parameter.Name is { } name)
            {
                parameter.Name = JsonNamingPolicy.CamelCase.ConvertName(name);
            }
        }

        return Task.CompletedTask;
    });
    options.AddDocumentTransformer<BearerSecuritySchemeTransformer>();
    options.AddOperationTransformer<BearerSecuritySchemeTransformer>();
});

// Authentication (D-10): JWT bearer tokens issued by POST /api/auth/login.
// Secure by default: the fallback policy requires an authenticated user on every endpoint;
// only endpoints marked [AllowAnonymous] (login) are open.
var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
if (!isSeedCommand)
{
    jwtOptions.Validate();
}
builder.Services.AddSingleton(jwtOptions);
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Keep the standard claim names ("sub", "name") instead of mapping them to long WS-* URIs
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = jwtOptions.GetSigningKey(),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            NameClaimType = JwtRegisteredClaimNames.Sub,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

// One error format for the whole API: every error response is ProblemDetails with a traceId.
// Invalid input is reported by ASP.NET model validation as ValidationProblemDetails (D-18);
// exceptions nobody handled end up in GlobalExceptionHandler.
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context =>
        context.ProblemDetails.Extensions.TryAdd(
            "traceId", Activity.Current?.Id ?? context.HttpContext.TraceIdentifier));
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// Data access: the connection string can be overridden by user-secrets or the
// ConnectionStrings__RequestsDb environment variable (D-17)
var connectionString = builder.Configuration.GetConnectionString("RequestsDb")
    ?? throw new InvalidOperationException("Connection string 'RequestsDb' is not configured.");
var databaseOptions = builder.Configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>()
    ?? new DatabaseOptions();
builder.Services.AddDataAccess(connectionString, databaseOptions);
builder.Services.AddBusinessLogic();

var app = builder.Build();

if (isSeedCommand)
{
    return await SeedCommand.RunAsync(app.Services, args);
}

// Migrate and seed an empty database when enabled in configuration (Development only by default, D-17)
await app.Services.InitializeDatabaseAsync();

// Warm the (possibly just seeded, so cold) database and the summary cache before the first request can arrive (D-48)
await StartupWarmUp.RunAsync(app.Services, app.Logger, app.Lifetime.ApplicationStopping);

// Configure the HTTP request pipeline.

// Server-Timing header (D-25): first, so the total covers the whole pipeline, error responses included.
// Off by default because it exposes internal timings; on in appsettings.Development.json.
if (app.Configuration.GetValue<bool>("ServerTiming:Enabled"))
{
    app.UseMiddleware<ServerTimingMiddleware>();
}

app.UseExceptionHandler();
// Also answers bodiless errors (unknown route, wrong method) as ProblemDetails
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    // The API description itself is public (Development only), so Swagger UI can load it before login
    app.MapOpenApi().AllowAnonymous();
    // Swagger UI (at /swagger) on top of the built-in OpenAPI document, for manual testing
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "Requests Management API v1");
        // Keep the token after a page refresh while testing
        options.EnablePersistAuthorization();
    });
}

// Not in Development (D-48): the API runs there on plain http (the "http" profile, behind the Angular dev proxy),
// with no HTTPS port to redirect to, so the middleware would only log "Failed to determine the https port".
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

await app.RunAsync();
return 0;
