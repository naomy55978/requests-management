using System.Diagnostics;
using RequestsManagement.API.Commands;
using RequestsManagement.API.Middleware;
using RequestsManagement.DAL;

// In "seed" mode the arguments belong to the seed command, not to the configuration system
var isSeedCommand = SeedCommand.IsInvoked(args);
var builder = WebApplication.CreateBuilder(isSeedCommand ? [] : args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

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

var app = builder.Build();

if (isSeedCommand)
{
    return await SeedCommand.RunAsync(app.Services, args);
}

// Migrate and seed an empty database when enabled in configuration (Development only by default, D-17)
await app.Services.InitializeDatabaseAsync();

// Configure the HTTP request pipeline.
app.UseExceptionHandler();
// Also answers bodiless errors (unknown route, wrong method) as ProblemDetails
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

await app.RunAsync();
return 0;
