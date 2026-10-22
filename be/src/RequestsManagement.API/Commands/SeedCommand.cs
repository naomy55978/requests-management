using RequestsManagement.DAL;
using RequestsManagement.DAL.Seeding;

namespace RequestsManagement.API.Commands;

/// <summary>
/// Command line mode that seeds the database and exits without starting the web server:
/// <c>dotnet run --project src/RequestsManagement.API -- seed [--count N] [--reset]</c>
/// </summary>
internal static class SeedCommand
{
    public const string Name = "seed";

    private const int DefaultCount = 100_000;
    private const int MaxCount = 1_000_000;

    private static readonly string Usage =
        "Usage: dotnet run --project src/RequestsManagement.API -- seed [--count N] [--reset]\n" +
        $"  --count N   number of requests to create (1-{MaxCount:N0}, default {DefaultCount:N0})\n" +
        "  --reset     drop and re-create the database first (allowed only for the 'RequestsManagement' database)";

    public static bool IsInvoked(string[] args) => args.Length > 0 && args[0] == Name;

    /// <returns>Process exit code: 0 on success, 1 on invalid arguments or refused seeding.</returns>
    public static async Task<int> RunAsync(IServiceProvider services, string[] args)
    {
        if (!TryParse(args.Skip(1).ToArray(), out var count, out var reset, out var error))
        {
            Console.Error.WriteLine(error);
            Console.Error.WriteLine(Usage);
            return 1;
        }

        // Ctrl+C cancels the seed (the bulk copy runs in a transaction, so nothing partial is left)
        using var cancellation = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            cancellation.Cancel();
        };

        try
        {
            await services.SeedDatabaseAsync(count, reset, cancellation.Token);
            return 0;
        }
        catch (DatabaseSeedException ex)
        {
            Console.Error.WriteLine($"Seed refused: {ex.Message}");
            return 1;
        }
    }

    private static bool TryParse(string[] args, out int count, out bool reset, out string error)
    {
        count = DefaultCount;
        reset = false;
        error = "";

        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--reset":
                    reset = true;
                    break;
                case "--count" when i + 1 < args.Length && int.TryParse(args[i + 1], out var value):
                    if (value is < 1 or > MaxCount)
                    {
                        error = $"--count must be between 1 and {MaxCount:N0}.";
                        return false;
                    }
                    count = value;
                    i++;
                    break;
                default:
                    error = $"Unknown or incomplete argument: '{args[i]}'.";
                    return false;
            }
        }
        return true;
    }
}
