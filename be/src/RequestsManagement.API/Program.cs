using RequestsManagement.DAL;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Data access: the connection string can be overridden by user-secrets or the
// ConnectionStrings__RequestsDb environment variable (D-17)
var connectionString = builder.Configuration.GetConnectionString("RequestsDb")
    ?? throw new InvalidOperationException("Connection string 'RequestsDb' is not configured.");
var databaseOptions = builder.Configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>()
    ?? new DatabaseOptions();
builder.Services.AddDataAccess(connectionString, databaseOptions);

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
