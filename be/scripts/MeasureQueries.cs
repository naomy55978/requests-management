// File-based apps are Native AOT by default, which disables reflection-based JSON; a measurement script does not need AOT
#:property PublishAot=false
#:package Microsoft.Data.SqlClient@6.1.7
// Same pin as in the DAL project: SqlClient 6.1.7 brings a Pkcs version with known vulnerabilities
#:package System.Security.Cryptography.Pkcs@10.0.13

// Query performance measurement for M8 (docs/PERFORMANCE.md in the docs repository).
//
// Runs the exact SQL that EF Core generates for the main API scenarios (captured from the EF command log,
// same text and same parameter types, sent as sp_executesql like EF does) and records for every statement:
//   * logical reads per table (SET STATISTICS IO) – the primary metric, independent of the machine's memory;
//   * the actual execution plan (SET STATISTICS XML), saved as a .sqlplan file and summarized as text
//     (operators, Sort, Key Lookup, memory grant, degree of parallelism);
//   * warm timings (secondary metric): median server CPU/elapsed (SET STATISTICS TIME) and client round trip.
// W1 measures the write cost of one status change (the repository's UPDATE + history INSERT) inside a
// transaction that is rolled back, including the transaction log bytes it generated.
//
//   dotnet run scripts/MeasureQueries.cs -- --out <dir> --label final
//   dotnet run scripts/MeasureQueries.cs -- --out <dir> --label before --shape original
//   dotnet run scripts/MeasureQueries.cs -- --out <dir> --label no-IX_x --disable IX_x --no-plans
//   dotnet run scripts/MeasureQueries.cs -- --out <dir> --label alternatives --alternatives
//   dotnet run scripts/MeasureQueries.cs -- --out <dir> --compare before final
//
// Options: --server (default: SQL_SERVER env or (localdb)\MSSQLLocalDB), --runs (timed runs, default 10),
// --shape original|final (the SQL before M8 or the current one, default final), --alternatives (candidate query
// shapes of the bottleneck analysis instead of the API's statements), --no-plans (do not keep .sqlplan files).
// Results go to <dir>/<label>/: results.json, results.md (tables, index sizes, plan trees) and plans/*.sqlplan.
// Read-only for the data: W1 is rolled back. --disable turns one nonclustered index off for the run and always
// rebuilds it (finally); it is allowed only on the database named exactly "RequestsManagement".
// Never runs instance-wide commands: plans are cleared only for this database (CLEAR PROCEDURE_CACHE).

using System.Data;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Microsoft.Data.SqlClient;

const string DatabaseName = "RequestsManagement";
const string PlanColumn = "Microsoft SQL Server 2005 XML Showplan";
XNamespace sp = "http://schemas.microsoft.com/sqlserver/2004/07/showplan";

var outDir = Arg("--out", "");
var server = Arg("--server", Environment.GetEnvironmentVariable("SQL_SERVER") ?? @"(localdb)\MSSQLLocalDB");
var runs = int.Parse(Arg("--runs", "10"));
var label = Arg("--label", "");
var disableIndex = Arg("--disable", "");
var savePlans = !args.Contains("--no-plans");
// --shape original: the SQL the API sent before M8 (OFFSET over full rows, linguistic LIKE);
// --shape final (default): the SQL since M8 (deferred join; UPPER + binary collation in the search)
var finalShape = Arg("--shape", "final") == "final";
// --alternatives measures candidate query shapes for the bottleneck analysis instead of the API's statements
var alternatives = args.Contains("--alternatives");
var json = new JsonSerializerOptions { WriteIndented = true };

if (outDir == "")
{
    Console.Error.WriteLine("--out <dir> is required");
    return 2;
}

if (args.Contains("--compare"))
{
    var i = Array.IndexOf(args, "--compare");
    return Compare(args[i + 1], args[i + 2]);
}

if (label == "")
{
    Console.Error.WriteLine("--label <name> is required");
    return 2;
}

var connectionString = $"Server={server};Database={DatabaseName};Trusted_Connection=True;TrustServerCertificate=True;Application Name=MeasureQueries";
await using var connection = new SqlConnection(connectionString);
var messages = new List<string>();
connection.InfoMessage += (_, e) => messages.Add(e.Message);
await connection.OpenAsync();

// Ctrl+C cancels the running command, so the finally below still rebuilds a disabled index
using var cancel = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cancel.Cancel(); };

// A run that was killed hard (no finally) may have left an index disabled: repair that first
await RebuildDisabledIndexesAsync();

var labelDir = Path.Combine(outDir, label);
var planDir = Path.Combine(labelDir, "plans");
Directory.CreateDirectory(planDir);

try
{
    if (disableIndex != "")
    {
        await DisableIndexAsync(disableIndex);
    }

    // Memory at the start and at the end of the run: timings depend on it (the instance and the machine are shared)
    var environment = await EnvironmentInfoAsync();

    // Fresh plans for this database only (never DBCC FREEPROCCACHE: the instance is shared)
    await ExecAsync("ALTER DATABASE SCOPED CONFIGURATION CLEAR PROCEDURE_CACHE");

    // Warm-up: read every page of both tables once, so the timings below are warm
    Console.WriteLine("Warm-up (reading both tables into the buffer pool)...");
    await ExecAsync("SELECT COUNT_BIG(*) FROM Requests WITH (INDEX(0)) OPTION (MAXDOP 1); SELECT COUNT_BIG(*) FROM RequestStatusHistory WITH (INDEX(0))");
    foreach (var tableAndIndex in await ScalarListAsync(
                 "SELECT '[' + OBJECT_NAME(object_id) + '] WITH (INDEX([' + name + ']))' FROM sys.indexes " +
                 "WHERE object_id IN (OBJECT_ID('Requests'), OBJECT_ID('RequestStatusHistory')) AND type = 2 AND is_disabled = 0"))
    {
        await ExecAsync($"SELECT COUNT_BIG(*) FROM {tableAndIndex}");
    }

    var results = new List<StatementResult>();

    foreach (var statement in alternatives ? AlternativeStatements() : Statements())
    {
        Console.Write($"{statement.Id,-10} {statement.Title}");
        results.Add(await MeasureAsync(statement));
        var r = results[^1];
        Console.WriteLine($"  reads {r.LogicalReads,7}  grant {r.GrantedMemoryKb,7} KB  dop {r.Dop}  elapsed {r.ElapsedMs,6:0.0} ms");
    }

    if (!alternatives)
    {
        results.Add(await MeasureWriteAsync());
    }

    Console.WriteLine(alternatives ? "" : $"W1         status change: reads {results[^1].LogicalReads}, log {results[^1].LogBytes} bytes");

    var environmentEnd = await EnvironmentInfoAsync();
    foreach (var key in new[] { "sqlCommittedMb", "sqlTargetMb", "osAvailableMb" })
    {
        environment[key + "AtEnd"] = environmentEnd[key];
    }

    var report = new RunReport(label, disableIndex, DateTime.UtcNow, environment, await IndexSizesAsync(), results);
    await File.WriteAllTextAsync(Path.Combine(labelDir, "results.json"), JsonSerializer.Serialize(report, json));
    await File.WriteAllTextAsync(Path.Combine(labelDir, "results.md"), ToMarkdown(report));
    Console.WriteLine($"\nResults: {Path.GetFullPath(labelDir)}");
}
finally
{
    if (disableIndex != "")
    {
        // Not cancellable: the index must be back even after Ctrl+C or a failure
        await ExecAsync($"ALTER INDEX [{disableIndex}] ON [Requests] REBUILD", CancellationToken.None);
        Console.WriteLine($"Index {disableIndex} rebuilt.");
    }

    var disabled = await ScalarListAsync("SELECT name FROM sys.indexes WHERE is_disabled = 1", CancellationToken.None);
    Console.WriteLine(disabled.Count == 0 ? "Check: all indexes are enabled." : $"WARNING: disabled indexes: {string.Join(", ", disabled)}");
}

if (!savePlans)
{
    Directory.Delete(planDir, recursive: true);
}

return 0;

// ---------------------------------------------------------------------------------------------------------
// The measured statements: the SQL EF Core 10 generates for each API scenario, with EF's parameter types
// ---------------------------------------------------------------------------------------------------------
IEnumerable<Statement> Statements()
{
    const string Columns = "SELECT [r].[Id], [r].[Title], [r].[OrganizationName], [r].[Status], [r].[Priority], [r].[AssignedTo], [r].[CreatedAt], [r].[UpdatedAt], [r].[RowVersion]\nFROM [Requests] AS [r]";
    const string CombinedWhere = "WHERE [r].[Status] IN (@statuses1, @statuses2) AND [r].[Priority] = @priorities1";
    SqlParameter[] Combined() =>
    [
        Byte("@statuses1", 2), Byte("@statuses2", 3), // InProgress, Waiting
        Byte("@priorities1", 3)                         // High
    ];
    SqlParameter[] Page(int offset, int size) => [Int("@p", offset), Int("@p1", size)];
    string Paged(string where, string orderBy) => finalShape
        // Deferred join, exactly as EF generates it for RequestRepository.GetPageAsync since M8
        ? $"""
            SELECT [r0].[Id], [r0].[Title], [r0].[OrganizationName], [r0].[Status], [r0].[Priority], [r0].[AssignedTo], [r0].[CreatedAt], [r0].[UpdatedAt], [r0].[RowVersion]
            FROM (
                SELECT [r].[Id]
                FROM [Requests] AS [r]
                {where}
                ORDER BY {orderBy}
                OFFSET @p ROWS FETCH NEXT @p1 ROWS ONLY
            ) AS [r1]
            INNER JOIN [Requests] AS [r0] ON [r1].[Id] = [r0].[Id]
            ORDER BY {orderBy.Replace("[r].", "[r0].")}
            """
        : $"{Columns}\n{where}\nORDER BY {orderBy}\nOFFSET @p ROWS FETCH NEXT @p1 ROWS ONLY".Replace("\n\n", "\n");

    // Q1 – main list: combined filter (2 statuses + priority), default sort, first page
    yield return new("Q1.count", "list: status IN (InProgress,Waiting) + priority=High – COUNT",
        $"SELECT COUNT(*)\nFROM [Requests] AS [r]\n{CombinedWhere}", Combined());
    yield return new("Q1.page", "list: same filter, sort createdAt desc, page 1 x 20",
        Paged(CombinedWhere, "[r].[CreatedAt] DESC, [r].[Id] DESC"), [.. Combined(), .. Page(0, 20)]);

    // Q1s – a selective combination (one status, one priority: ~1.8% of the rows)
    const string SelectiveWhere = "WHERE [r].[Status] = @statuses1 AND [r].[Priority] = @priorities1";
    SqlParameter[] Selective() => [Byte("@statuses1", 1), Byte("@priorities1", 3)]; // New, High
    yield return new("Q1s.count", "list: status=New + priority=High – COUNT",
        $"SELECT COUNT(*)\nFROM [Requests] AS [r]\n{SelectiveWhere}", Selective());
    yield return new("Q1s.page", "list: status=New + priority=High, sort createdAt desc, page 1 x 20",
        Paged(SelectiveWhere, "[r].[CreatedAt] DESC, [r].[Id] DESC"), [.. Selective(), .. Page(0, 20)]);

    // Q2 – same filter, sorted by updatedAt (the COUNT is identical to Q1.count)
    yield return new("Q2.page", "list: same filter, sort updatedAt desc, page 1 x 20",
        Paged(CombinedWhere, "[r].[UpdatedAt] DESC, [r].[Id] DESC"), [.. Combined(), .. Page(0, 20)]);

    // Q3/Q4 – no filter: default sort and every other sort field (one COUNT for all of them)
    yield return new("Q3.count", "list: no filter – COUNT", "SELECT COUNT(*)\nFROM [Requests] AS [r]", []);
    yield return new("Q3.page", "list: no filter, sort createdAt desc, page 1 x 20",
        Paged("", "[r].[CreatedAt] DESC, [r].[Id] DESC"), Page(0, 20));
    yield return new("Q4.updated", "list: no filter, sort updatedAt desc, page 1 x 20",
        Paged("", "[r].[UpdatedAt] DESC, [r].[Id] DESC"), Page(0, 20));
    yield return new("Q4.priority", "list: no filter, sort priority desc, page 1 x 20",
        Paged("", "[r].[Priority] DESC, [r].[Id] DESC"), Page(0, 20));
    yield return new("Q4.status", "list: no filter, sort status desc, page 1 x 20",
        Paged("", "[r].[Status] DESC, [r].[Id] DESC"), Page(0, 20));
    yield return new("Q4.title", "list: no filter, sort title asc, page 1 x 20",
        Paged("", "[r].[Title], [r].[Id]"), Page(0, 20));

    // Q5 – deep OFFSET: the last page (1000 x 100)
    yield return new("Q5.created", "deep page 1000 x 100, sort createdAt desc",
        Paged("", "[r].[CreatedAt] DESC, [r].[Id] DESC"), Page(99_900, 100));
    yield return new("Q5.title", "deep page 1000 x 100, sort title asc",
        Paged("", "[r].[Title], [r].[Id]"), Page(99_900, 100));

    // Q6 – free-text search (contains): LIKE '%x%' on two columns
    var searchWhere = finalShape
        // UPPER on both sides + binary collation (M8); one nvarchar(4000) parameter, as EF sends it
        ? @"WHERE UPPER([r].[Title]) COLLATE Latin1_General_100_BIN2 LIKE UPPER(@pattern) ESCAPE N'\' OR UPPER([r].[OrganizationName]) COLLATE Latin1_General_100_BIN2 LIKE UPPER(@pattern) ESCAPE N'\'"
        : @"WHERE [r].[Title] LIKE @pattern ESCAPE N'\' OR [r].[OrganizationName] LIKE @pattern0 ESCAPE N'\'";
    SqlParameter[] Search() => finalShape
        ? [NVarChar("@pattern", 4000, "%bonus%")]
        : [NVarChar("@pattern", 200, "%bonus%"), NVarChar("@pattern0", 150, "%bonus%")];
    yield return new("Q6.count", "search=bonus (LIKE '%x%') – COUNT", $"SELECT COUNT(*)\nFROM [Requests] AS [r]\n{searchWhere}", Search());
    yield return new("Q6.page", "search=bonus, sort createdAt desc, page 1 x 20",
        Paged(searchWhere, "[r].[CreatedAt] DESC, [r].[Id] DESC"), [.. Search(), .. Page(0, 20)]);

    // Q7 – the other single filters
    const string AssignedWhere = "WHERE [r].[AssignedTo] = @assignedTo";
    yield return new("Q7a.count", "assignedTo=adi.ezra – COUNT", $"SELECT COUNT(*)\nFROM [Requests] AS [r]\n{AssignedWhere}",
        [NVarChar("@assignedTo", 100, "adi.ezra")]);
    yield return new("Q7a.page", "assignedTo=adi.ezra, page 1 x 20", Paged(AssignedWhere, "[r].[CreatedAt] DESC, [r].[Id] DESC"),
        [NVarChar("@assignedTo", 100, "adi.ezra"), .. Page(0, 20)]);
    const string OrgWhere = "WHERE [r].[OrganizationName] LIKE @prefix ESCAPE N'\\'";
    yield return new("Q7b.count", "organization=Hermon (prefix) – COUNT", $"SELECT COUNT(*)\nFROM [Requests] AS [r]\n{OrgWhere}",
        [NVarChar("@prefix", 150, "Hermon%")]);
    yield return new("Q7b.page", "organization=Hermon, page 1 x 20", Paged(OrgWhere, "[r].[CreatedAt] DESC, [r].[Id] DESC"),
        [NVarChar("@prefix", 150, "Hermon%"), .. Page(0, 20)]);
    const string DateWhere = "WHERE [r].[CreatedAt] >= @fromDate AND [r].[CreatedAt] < @beforeDate";
    SqlParameter[] Dates() => [DateTime2("@fromDate", new(2026, 1, 1)), DateTime2("@beforeDate", new(2026, 2, 1))];
    yield return new("Q7c.count", "createdFrom/To = January 2026 – COUNT", $"SELECT COUNT(*)\nFROM [Requests] AS [r]\n{DateWhere}", Dates());
    yield return new("Q7c.page", "January 2026, page 1 x 20", Paged(DateWhere, "[r].[CreatedAt] DESC, [r].[Id] DESC"),
        [.. Dates(), .. Page(0, 20)]);

    // Q8 – the summary: three aggregations (cached for 60 s by the API, D-11)
    yield return new("Q8.status", "summary: count by status",
        "SELECT [r].[Status], COUNT(*) AS [Count]\nFROM [Requests] AS [r]\nGROUP BY [r].[Status]", []);
    yield return new("Q8.priority", "summary: count by priority",
        "SELECT [r].[Priority], COUNT(*) AS [Count]\nFROM [Requests] AS [r]\nGROUP BY [r].[Priority]", []);
    yield return new("Q8.orgs", "summary: top 10 organizations by open requests",
        "SELECT TOP(@p) [r].[OrganizationName], COUNT(*) AS [OpenRequests]\nFROM [Requests] AS [r]\nWHERE [r].[Status] <> CAST(4 AS tinyint)\nGROUP BY [r].[OrganizationName]\nORDER BY COUNT(*) DESC, [r].[OrganizationName]",
        [Int("@p", 10)]);

    // Q9 – history of one request
    yield return new("Q9.history", "history of request 12345",
        "SELECT [r].[PreviousStatus], [r].[NewStatus], [r].[ChangedAt], [r].[ChangedBy]\nFROM [RequestStatusHistory] AS [r]\nWHERE [r].[RequestId] = @id\nORDER BY [r].[ChangedAt], [r].[Id]",
        [Int("@id", 12345)]);
}

// Candidate query shapes for the remaining bottlenecks (not used by the API; measured for docs/PERFORMANCE.md)
IEnumerable<Statement> AlternativeStatements()
{
    const string Columns = """
        SELECT [r].[Id], [r].[Title], [r].[OrganizationName], [r].[Status], [r].[Priority], [r].[AssignedTo], [r].[CreatedAt], [r].[UpdatedAt], [r].[RowVersion]
        FROM [Requests] AS [r]
        """;
    SqlParameter[] Page(int offset, int size) => [Int("@p", offset), Int("@p1", size)];

    // Deferred join: OFFSET walks only a narrow index (keys + Id); the full rows are read for the page only
    string Deferred(string orderBy) => $"""
        {Columns}
        INNER JOIN (
            SELECT [k].[Id] FROM [Requests] AS [k]
            ORDER BY {orderBy.Replace("[r]", "[k]")}
            OFFSET @p ROWS FETCH NEXT @p1 ROWS ONLY
        ) AS [page] ON [page].[Id] = [r].[Id]
        ORDER BY {orderBy}
        """;
    yield return new("A1.created", "deferred join: deep page 1000 x 100, createdAt desc", Deferred("[r].[CreatedAt] DESC, [r].[Id] DESC"), Page(99_900, 100));
    yield return new("A1.title", "deferred join: deep page 1000 x 100, title asc", Deferred("[r].[Title], [r].[Id]"), Page(99_900, 100));
    yield return new("A1.first", "deferred join: page 1 x 20, createdAt desc (page 1 must not get worse)", Deferred("[r].[CreatedAt] DESC, [r].[Id] DESC"), Page(0, 20));
    yield return new("A2.status", "deferred join: sort status desc, page 1 x 20 (sorts keys only)", Deferred("[r].[Status] DESC, [r].[Id] DESC"), Page(0, 20));
    yield return new("A3.status", "sort status desc, page 1 x 20 with OPTION (MAXDOP 1)", $"""
        {Columns}
        ORDER BY [r].[Status] DESC, [r].[Id] DESC
        OFFSET @p ROWS FETCH NEXT @p1 ROWS ONLY
        OPTION (MAXDOP 1)
        """, Page(0, 20));

    // Search: one query with COUNT(*) OVER() instead of COUNT + page
    const string SearchWhere = @"WHERE [r].[Title] LIKE @pattern ESCAPE N'\' OR [r].[OrganizationName] LIKE @pattern0 ESCAPE N'\'";
    SqlParameter[] Search() => [NVarChar("@pattern", 200, "%bonus%"), NVarChar("@pattern0", 150, "%bonus%")];
    yield return new("A4.search", "search: COUNT(*) OVER() + page in one query", $"""
        SELECT [r].[Id], [r].[Title], [r].[OrganizationName], [r].[Status], [r].[Priority], [r].[AssignedTo], [r].[CreatedAt], [r].[UpdatedAt], [r].[RowVersion], COUNT(*) OVER() AS [TotalCount]
        FROM [Requests] AS [r]
        {SearchWhere}
        ORDER BY [r].[CreatedAt] DESC, [r].[Id] DESC
        OFFSET @p ROWS FETCH NEXT @p1 ROWS ONLY
        """, [.. Search(), .. Page(0, 20)]);

    // Where the search time goes: the same scan with a binary collation (case-sensitive – NOT the API's semantics;
    // shows how much of the time is the linguistic Unicode comparison)
    yield return new("A5.binary", "search COUNT with a binary collation (different semantics – for analysis only)", """
        SELECT COUNT(*)
        FROM [Requests] AS [r]
        WHERE [r].[Title] COLLATE Latin1_General_100_BIN2 LIKE @pattern ESCAPE N'\'
           OR [r].[OrganizationName] COLLATE Latin1_General_100_BIN2 LIKE @pattern0 ESCAPE N'\'
        """, Search());

    // Case-insensitive like the API, but compared as binary: UPPER on both sides + a binary collation
    yield return new("A5.upper", "search COUNT: UPPER(column) with a binary collation vs UPPER(pattern)", """
        SELECT COUNT(*)
        FROM [Requests] AS [r]
        WHERE UPPER([r].[Title]) COLLATE Latin1_General_100_BIN2 LIKE UPPER(@pattern) ESCAPE N'\'
           OR UPPER([r].[OrganizationName]) COLLATE Latin1_General_100_BIN2 LIKE UPPER(@pattern0) ESCAPE N'\'
        """, Search());

    // Prefix search on the title (LIKE 'x%') can seek IX_Requests_Title – a different feature, shown for comparison
    yield return new("A6.prefix", "title prefix LIKE 'Bonus%' – COUNT (seek; different semantics)", """
        SELECT COUNT(*)
        FROM [Requests] AS [r]
        WHERE [r].[Title] LIKE @pattern ESCAPE N'\'
        """, [NVarChar("@pattern", 200, "Bonus%")]);
}

// ---------------------------------------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------------------------------------
async Task<StatementResult> MeasureAsync(Statement statement)
{
    // Two warm-up executions (compile the plan, load the pages)
    for (var i = 0; i < 2; i++)
    {
        await RunAsync(statement, capturePlan: false);
    }

    // One execution with the actual plan and STATISTICS IO
    await ExecAsync("SET STATISTICS IO ON; SET STATISTICS XML ON");
    var (plans, ioMessages, rowCount, _) = await RunAsync(statement, capturePlan: true);
    await ExecAsync("SET STATISTICS IO OFF; SET STATISTICS XML OFF");
    var plan = plans.Last();
    if (savePlans)
    {
        await File.WriteAllTextAsync(Path.Combine(planDir, statement.Id + ".sqlplan"), plan);
    }

    // Timed executions without the plan overhead
    var timings = await TimeAsync(async () => ServerTime((await RunAsync(statement, capturePlan: false)).Messages));

    return BuildResult(statement.Id, statement.Title, rowCount, ioMessages, [plan], timings);
}

// W1: one status change exactly as the repository writes it (UPDATE ... OUTPUT + history INSERT), rolled back
async Task<StatementResult> MeasureWriteAsync()
{
    // A request in status New (New -> InProgress is allowed); always the same one for comparable runs
    var id = (int)(await ScalarAsync("SELECT MIN(Id) FROM Requests WHERE Status = 1"))!;

    // Returns the plans (when captured), the messages of the UPDATE and of the INSERT, and the log bytes
    async Task<(List<string> Plans, List<string> UpdateMessages, List<string> InsertMessages, long LogBytes)> OneAsync(bool capture)
    {
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(cancel.Token);
        var version = (byte[])(await ScalarAsync($"SELECT RowVersion FROM Requests WHERE Id = {id}", tx))!;
        if (capture)
        {
            await ExecAsync("SET STATISTICS IO ON; SET STATISTICS XML ON", tx: tx);
        }

        messages.Clear();
        var plans = new List<string>();
        var update = """
            UPDATE [Requests]
            SET [Status] = @newStatus, [UpdatedAt] = @changedAt
            OUTPUT deleted.[Status] AS [PreviousStatus], inserted.[Id], inserted.[Title], inserted.[OrganizationName],
                   inserted.[Status], inserted.[Priority], inserted.[AssignedTo], inserted.[CreatedAt],
                   inserted.[UpdatedAt], inserted.[RowVersion]
            WHERE [Id] = @id AND [RowVersion] = @expectedVersion
              AND [Status] IN (@allowed0)
            """;
        plans.AddRange((await ReadAllAsync(update,
            [Byte("@newStatus", 2), DateTime2("@changedAt", DateTime.UtcNow), Int("@id", id),
             new("@expectedVersion", SqlDbType.Binary, 8) { Value = version }, Byte("@allowed0", 1)], tx)).Plans);
        var updateMessages = messages.ToList();
        messages.Clear();
        // The history INSERT as EF's ExecuteSqlAsync sends it (interpolated values become parameters)
        plans.AddRange((await ReadAllAsync(
            "INSERT INTO [RequestStatusHistory] ([RequestId], [PreviousStatus], [NewStatus], [ChangedAt], [ChangedBy])\nVALUES (@p0, @p1, @p2, @p3, @p4)",
            [Int("@p0", id), Byte("@p1", 1), Byte("@p2", 2), DateTime2("@p3", DateTime.UtcNow), NVarChar("@p4", 4000, "dana.cohen")], tx)).Plans);
        var insertMessages = messages.ToList();
        if (capture)
        {
            await ExecAsync("SET STATISTICS IO OFF; SET STATISTICS XML OFF", tx: tx);
        }

        var logBytes = (long)(await ScalarAsync(
            "SELECT database_transaction_log_bytes_used FROM sys.dm_tran_database_transactions WHERE transaction_id = CURRENT_TRANSACTION_ID() AND database_id = DB_ID()", tx))!;
        await tx.RollbackAsync(cancel.Token);
        return (plans, updateMessages, insertMessages, logBytes);
    }

    await OneAsync(false);
    var (writePlans, updateIo, insertIo, logBytesUsed) = await OneAsync(true);
    if (savePlans)
    {
        await File.WriteAllTextAsync(Path.Combine(planDir, "W1.update.sqlplan"), writePlans[0]);
        await File.WriteAllTextAsync(Path.Combine(planDir, "W1.insert.sqlplan"), writePlans[1]);
    }

    // Server time = UPDATE + INSERT; the client time also includes the transaction's own round trips
    var timings = await TimeAsync(async () =>
    {
        var (_, updateMessages, insertMessages, _) = await OneAsync(false);
        var (updateTime, insertTime) = (ServerTime(updateMessages), ServerTime(insertMessages));
        return (updateTime.Cpu + insertTime.Cpu, updateTime.Elapsed + insertTime.Elapsed);
    });

    var result = BuildResult("W1", "status change New -> InProgress (UPDATE + history INSERT, rolled back)", 1,
        [.. updateIo, .. insertIo], writePlans, timings);
    return result with { LogBytes = logBytesUsed };
}

// Runs the statement and reads every row; returns the plans (when captured), the messages, the row count and the client time
async Task<(List<string> Plans, List<string> Messages, int Rows, double ClientMs)> RunAsync(Statement statement, bool capturePlan)
{
    messages.Clear();
    var stopwatch = Stopwatch.StartNew();
    var (plans, rows) = await ReadAllAsync(statement.Sql, statement.Parameters());
    var clientMs = stopwatch.Elapsed.TotalMilliseconds;
    return (plans, messages.ToList(), rows, clientMs);
}

async Task<(List<string> Plans, int Rows)> ReadAllAsync(string sql, SqlParameter[] parameters, SqlTransaction? tx = null)
{
    await using var command = new SqlCommand(sql, connection, tx) { CommandTimeout = 300 };
    command.Parameters.AddRange(parameters);
    var plans = new List<string>();
    var rows = 0;
    await using var reader = await command.ExecuteReaderAsync(cancel.Token);
    do
    {
        var isPlan = reader.FieldCount == 1 && reader.GetName(0) == PlanColumn;
        while (await reader.ReadAsync(cancel.Token))
        {
            if (isPlan)
            {
                plans.Add(reader.GetString(0));
            }
            else
            {
                rows++;
            }
        }
    } while (await reader.NextResultAsync(cancel.Token));

    return (plans, rows);
}

// `runs` executions with STATISTICS TIME; medians of the server CPU/elapsed and of the client round trip
async Task<Timings> TimeAsync(Func<Task<(double Cpu, double Elapsed)>> run)
{
    await ExecAsync("SET STATISTICS TIME ON");
    var cpu = new List<double>();
    var elapsed = new List<double>();
    var client = new List<double>();
    for (var i = 0; i < runs; i++)
    {
        var stopwatch = Stopwatch.StartNew();
        var (cpuMs, elapsedMs) = await run();
        client.Add(stopwatch.Elapsed.TotalMilliseconds);
        cpu.Add(cpuMs);
        elapsed.Add(elapsedMs);
    }

    await ExecAsync("SET STATISTICS TIME OFF");
    return new Timings(Median(cpu), Median(elapsed), Median(client), client.Max());
}

// Server time of one command. sp_executesql reports "Execution Times" for the inner statement and again for
// itself (which includes the inner one), so the largest value is the time of the whole command.
static (double Cpu, double Elapsed) ServerTime(List<string> timeMessages)
{
    var times = timeMessages
        .SelectMany(m => Regex.Matches(m, @"Execution Times:\s+CPU time = (\d+) ms,\s+elapsed time = (\d+) ms"))
        .Select(m => (Cpu: double.Parse(m.Groups[1].Value), Elapsed: double.Parse(m.Groups[2].Value)))
        .ToList();
    return times.Count == 0 ? (0, 0) : (times.Max(t => t.Cpu), times.Max(t => t.Elapsed));
}

StatementResult BuildResult(string id, string title, int rows, List<string> ioMessages, List<string> plans, Timings timings)
{
    var reads = new Dictionary<string, long>();
    foreach (Match m in ioMessages.SelectMany(m => Regex.Matches(m, @"Table '([^']+)'\. Scan count \d+, logical reads (\d+)")))
    {
        reads[m.Groups[1].Value] = reads.GetValueOrDefault(m.Groups[1].Value) + long.Parse(m.Groups[2].Value);
    }

    var docs = plans.Select(XDocument.Parse).ToList();
    var queryPlans = docs.SelectMany(d => d.Descendants(sp + "QueryPlan")).ToList();
    var relOps = docs.SelectMany(d => d.Descendants(sp + "RelOp")).ToList();
    var grant = queryPlans.Sum(q => (long?)q.Element(sp + "MemoryGrantInfo")?.Attribute("GrantedMemory") ?? 0);
    var used = queryPlans.Sum(q => (long?)q.Element(sp + "MemoryGrantInfo")?.Attribute("MaxUsedMemory") ?? 0);
    var dop = queryPlans.Max(q => (int?)q.Attribute("DegreeOfParallelism") ?? 1);
    var indexes = relOps
        .SelectMany(op => OwnObjects(op).Select(o => $"{o.Attribute("Table")?.Value.Trim('[', ']')}.{o.Attribute("Index")?.Value.Trim('[', ']')}"))
        .Distinct().ToList();
    var warnings = docs.SelectMany(d => d.Descendants(sp + "Warnings")).SelectMany(w => w.Elements())
        .Select(w => w.Name.LocalName).Distinct().ToList();
    var tree = string.Join("\n", docs.Select(d => d.Descendants(sp + "RelOp").First()).Select(root => PlanTree(root, 0)));

    return new StatementResult(
        id, title, rows, reads.Values.Sum(), reads, dop, grant, used,
        relOps.Any(op => (string?)op.Attribute("PhysicalOp") == "Sort"),
        relOps.Any(IsLookup),
        indexes, warnings, tree, timings.CpuMs, timings.ElapsedMs, timings.ClientMs, timings.ClientMaxMs, LogBytes: null);
}

// In the plan XML a key lookup is a "Clustered Index Seek" whose IndexScan element has Lookup="1"
// (SSMS shows it as "Key Lookup")
bool IsLookup(XElement relOp) =>
    relOp.Elements().Any(e => e.Name == sp + "IndexScan" && (string?)e.Attribute("Lookup") is "1" or "true");

// The Object elements that belong to this operator itself (not to its child operators)
IEnumerable<XElement> OwnObjects(XElement relOp) =>
    relOp.Descendants(sp + "Object").Where(o => o.Ancestors(sp + "RelOp").First() == relOp);

// Indented operator tree with actual rows, e.g. "Top (20)\n  Index Scan [IX_Requests_CreatedAt] (40)"
string PlanTree(XElement relOp, int depth)
{
    var physical = (string)relOp.Attribute("PhysicalOp")!;
    var logical = (string)relOp.Attribute("LogicalOp")!;
    var name = IsLookup(relOp) ? "Key Lookup"
        : physical == logical || logical.Length == 0 ? physical : $"{physical} ({logical})";
    var objects = OwnObjects(relOp).Select(o => o.Attribute("Index")?.Value ?? o.Attribute("Table")?.Value).Where(n => n is not null).Distinct();
    var counters = relOp.Element(sp + "RunTimeInformation")?.Elements(sp + "RunTimeCountersPerThread").ToList();
    var actualRows = counters?.Sum(c => (long?)c.Attribute("ActualRows") ?? 0);
    var executions = counters?.Sum(c => (long?)c.Attribute("ActualExecutions") ?? 0) ?? 0;
    var children = relOp.Descendants(sp + "RelOp").Where(c => c.Ancestors(sp + "RelOp").First() == relOp);
    var line = $"{new string(' ', depth * 2)}{name}{(objects.Any() ? " " + string.Join(", ", objects) : "")}" +
               (actualRows is null ? "" : $" – {actualRows:N0} rows") +
               // Executions matter for the inner side of a loop join (e.g. one key lookup per row)
               (executions > 1 && counters!.Count == 1 ? $", {executions:N0} executions" : "");
    return string.Join("\n", children.Select(c => PlanTree(c, depth + 1)).Prepend(line));
}

// ---------------------------------------------------------------------------------------------------------
// Index experiments (only on the database named exactly RequestsManagement, never the clustered index)
// ---------------------------------------------------------------------------------------------------------
async Task DisableIndexAsync(string index)
{
    if (connection.Database != DatabaseName)
    {
        throw new InvalidOperationException($"--disable is allowed only on the database '{DatabaseName}'.");
    }

    var type = await ScalarAsync($"SELECT type FROM sys.indexes WHERE object_id = OBJECT_ID('Requests') AND name = @name", null, NVarChar("@name", 128, index));
    if (type is null)
    {
        throw new InvalidOperationException($"No index '{index}' on Requests.");
    }

    if (Convert.ToInt32(type) != 2)
    {
        // Disabling the clustered index (PK) would make the whole table unreadable
        throw new InvalidOperationException($"'{index}' is not a nonclustered index; only nonclustered indexes may be disabled.");
    }

    await ExecAsync($"ALTER INDEX [{index}] ON [Requests] DISABLE");
    Console.WriteLine($"Index {index} disabled for this run.");
}

async Task RebuildDisabledIndexesAsync()
{
    foreach (var name in await ScalarListAsync("SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('Requests') AND is_disabled = 1 AND type = 2"))
    {
        Console.WriteLine($"Index {name} was left disabled by an earlier run – rebuilding it.");
        await ExecAsync($"ALTER INDEX [{name}] ON [Requests] REBUILD", CancellationToken.None);
    }
}

// ---------------------------------------------------------------------------------------------------------
// Environment and index sizes (recorded with every run)
// ---------------------------------------------------------------------------------------------------------
async Task<Dictionary<string, string>> EnvironmentInfoAsync()
{
    var info = new Dictionary<string, string>();
    await using var command = new SqlCommand("""
        SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(50)), CAST(SERVERPROPERTY('Edition') AS nvarchar(100)),
               (SELECT compatibility_level FROM sys.databases WHERE name = DB_NAME()),
               (SELECT COUNT(*) FROM Requests), (SELECT COUNT(*) FROM RequestStatusHistory),
               (SELECT committed_kb / 1024 FROM sys.dm_os_sys_info), (SELECT committed_target_kb / 1024 FROM sys.dm_os_sys_info),
               (SELECT available_physical_memory_kb / 1024 FROM sys.dm_os_sys_memory),
               (SELECT value_in_use FROM sys.configurations WHERE name = 'max degree of parallelism'),
               (SELECT value_in_use FROM sys.configurations WHERE name = 'cost threshold for parallelism')
        """, connection);
    await using var reader = await command.ExecuteReaderAsync(cancel.Token);
    await reader.ReadAsync(cancel.Token);
    string[] names = ["version", "edition", "compatibility", "requests", "history", "sqlCommittedMb", "sqlTargetMb", "osAvailableMb", "maxdop", "costThreshold"];
    for (var i = 0; i < names.Length; i++)
    {
        info[names[i]] = Convert.ToString(reader.GetValue(i))!;
    }

    return info;
}

async Task<List<IndexSize>> IndexSizesAsync()
{
    var sizes = new List<IndexSize>();
    await using var command = new SqlCommand("""
        SELECT OBJECT_NAME(i.object_id), i.name, i.type_desc, SUM(s.used_page_count) * 8, SUM(s.row_count)
        FROM sys.indexes i JOIN sys.dm_db_partition_stats s ON s.object_id = i.object_id AND s.index_id = i.index_id
        WHERE i.object_id IN (OBJECT_ID('Requests'), OBJECT_ID('RequestStatusHistory'))
        GROUP BY i.object_id, i.name, i.type_desc, i.index_id
        ORDER BY OBJECT_NAME(i.object_id), i.index_id
        """, connection);
    await using var reader = await command.ExecuteReaderAsync(cancel.Token);
    while (await reader.ReadAsync(cancel.Token))
    {
        sizes.Add(new IndexSize(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetInt64(3), reader.GetInt64(4)));
    }

    return sizes;
}

// ---------------------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------------------
string ToMarkdown(RunReport report)
{
    var sb = new StringBuilder();
    sb.AppendLine($"# Measurement '{report.Label}'{(report.DisabledIndex == "" ? "" : $" (disabled: {report.DisabledIndex})")}");
    sb.AppendLine();
    sb.AppendLine($"UTC {report.TakenAtUtc:yyyy-MM-dd HH:mm}; " + string.Join("; ", report.Environment.Select(e => $"{e.Key}={e.Value}")));
    sb.AppendLine();
    sb.AppendLine("| Id | Statement | Rows | Logical reads | Sort | Key Lookup | Grant KB (used) | DOP | CPU ms | Elapsed ms | Client ms (max) | Indexes |");
    sb.AppendLine("|---|---|---|---|---|---|---|---|---|---|---|---|");
    foreach (var r in report.Results)
    {
        sb.AppendLine($"| {r.Id} | {r.Title} | {r.Rows} | {r.LogicalReads:N0} | {(r.HasSort ? "yes" : "")} | {(r.HasKeyLookup ? "yes" : "")} | " +
                      $"{(r.GrantedMemoryKb == 0 ? "" : $"{r.GrantedMemoryKb:N0} ({r.UsedMemoryKb:N0})")} | {r.Dop} | {r.CpuMs:0} | {r.ElapsedMs:0} | " +
                      $"{r.ClientMs:0.0} ({r.ClientMaxMs:0}) | {string.Join(", ", r.Indexes)} |");
    }

    sb.AppendLine();
    if (report.Results.SingleOrDefault(r => r.Id == "W1") is { } write)
    {
        sb.AppendLine($"W1 log bytes: {write.LogBytes:N0}; reads per table: {string.Join(", ", write.ReadsPerTable.Select(t => $"{t.Key} {t.Value}"))}");
        sb.AppendLine();
    }

    sb.AppendLine("## Index sizes");
    sb.AppendLine();
    sb.AppendLine("| Table | Index | Type | KB | Rows |");
    sb.AppendLine("|---|---|---|---|---|");
    foreach (var s in report.IndexSizes)
    {
        sb.AppendLine($"| {s.Table} | {s.Index} | {s.Type} | {s.Kb:N0} | {s.Rows:N0} |");
    }

    sb.AppendLine();
    sb.AppendLine("## Plans (actual rows)");
    foreach (var r in report.Results)
    {
        sb.AppendLine();
        sb.AppendLine($"### {r.Id} – {r.Title}");
        if (r.Warnings.Count > 0)
        {
            sb.AppendLine($"Warnings: {string.Join(", ", r.Warnings)}");
        }

        sb.AppendLine("```");
        sb.AppendLine(r.PlanTree);
        sb.AppendLine("```");
    }

    return sb.ToString();
}

int Compare(string beforeLabel, string afterLabel)
{
    var before = JsonSerializer.Deserialize<RunReport>(File.ReadAllText(Path.Combine(outDir, beforeLabel, "results.json")))!;
    var after = JsonSerializer.Deserialize<RunReport>(File.ReadAllText(Path.Combine(outDir, afterLabel, "results.json")))!;
    var sb = new StringBuilder();
    sb.AppendLine($"| Id | Statement | Reads {beforeLabel} → {afterLabel} | Sort | Grant KB | DOP | Elapsed ms | Client ms | Indexes ({afterLabel}) |");
    sb.AppendLine("|---|---|---|---|---|---|---|---|---|");
    foreach (var a in after.Results)
    {
        var b = before.Results.SingleOrDefault(r => r.Id == a.Id);
        if (b is null)
        {
            continue;
        }

        sb.AppendLine($"| {a.Id} | {a.Title} | {b.LogicalReads:N0} → {a.LogicalReads:N0} | {YesNo(b.HasSort)} → {YesNo(a.HasSort)} | " +
                      $"{b.GrantedMemoryKb:N0} → {a.GrantedMemoryKb:N0} | {b.Dop} → {a.Dop} | {b.ElapsedMs:0} → {a.ElapsedMs:0} | " +
                      $"{b.ClientMs:0.0} → {a.ClientMs:0.0} | {string.Join(", ", a.Indexes)} |");
    }

    var bw = before.Results.Single(r => r.Id == "W1");
    var aw = after.Results.Single(r => r.Id == "W1");
    sb.AppendLine();
    sb.AppendLine($"W1 log bytes: {bw.LogBytes:N0} → {aw.LogBytes:N0}; reads {bw.LogicalReads} → {aw.LogicalReads}");
    sb.AppendLine($"Index count (Requests): {before.IndexSizes.Count(s => s.Table == "Requests")} → {after.IndexSizes.Count(s => s.Table == "Requests")}; " +
                  $"nonclustered KB (Requests): {before.IndexSizes.Where(s => s.Table == "Requests" && s.Type != "CLUSTERED").Sum(s => s.Kb):N0} → " +
                  $"{after.IndexSizes.Where(s => s.Table == "Requests" && s.Type != "CLUSTERED").Sum(s => s.Kb):N0}");
    // Written next to the "after" results (a label may contain a folder, e.g. experiments/without-IX_x)
    var path = Path.Combine(outDir, afterLabel, $"compare-with-{Path.GetFileName(beforeLabel)}.md");
    File.WriteAllText(path, sb.ToString());
    Console.WriteLine(sb.ToString());
    Console.WriteLine($"Written to {Path.GetFullPath(path)}");
    return 0;

    static string YesNo(bool value) => value ? "yes" : "no";
}

// ---------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------
async Task ExecAsync(string sql, CancellationToken? token = null, SqlTransaction? tx = null)
{
    await using var command = new SqlCommand(sql, connection, tx) { CommandTimeout = 600 };
    await command.ExecuteNonQueryAsync(token ?? cancel.Token);
}

async Task<object?> ScalarAsync(string sql, SqlTransaction? tx = null, params SqlParameter[] parameters)
{
    await using var command = new SqlCommand(sql, connection, tx);
    command.Parameters.AddRange(parameters);
    var value = await command.ExecuteScalarAsync(cancel.Token);
    return value is DBNull ? null : value;
}

async Task<List<string>> ScalarListAsync(string sql, CancellationToken? token = null)
{
    var list = new List<string>();
    await using var command = new SqlCommand(sql, connection);
    await using var reader = await command.ExecuteReaderAsync(token ?? cancel.Token);
    while (await reader.ReadAsync(token ?? cancel.Token))
    {
        list.Add(reader.GetString(0));
    }

    return list;
}

static double Median(List<double> values)
{
    var sorted = values.Order().ToList();
    return sorted.Count % 2 == 1 ? sorted[sorted.Count / 2] : (sorted[sorted.Count / 2 - 1] + sorted[sorted.Count / 2]) / 2;
}

// Parameter types exactly as EF Core sends them
static SqlParameter Byte(string name, byte value) => new(name, SqlDbType.TinyInt) { Value = value };
static SqlParameter Int(string name, int value) => new(name, SqlDbType.Int) { Value = value };
static SqlParameter NVarChar(string name, int size, string value) => new(name, SqlDbType.NVarChar, size) { Value = value };
static SqlParameter DateTime2(string name, DateTime value) => new(name, SqlDbType.DateTime2) { Value = value };

string Arg(string name, string fallback)
{
    var index = Array.IndexOf(args, name);
    return index >= 0 && index + 1 < args.Length ? args[index + 1] : fallback;
}

record Statement(string Id, string Title, string Sql, SqlParameter[] ParameterTemplate)
{
    // A SqlParameter belongs to one command, so every execution gets fresh copies
    public SqlParameter[] Parameters() => ParameterTemplate
        .Select(p => new SqlParameter(p.ParameterName, p.SqlDbType, p.Size) { Value = p.Value })
        .ToArray();
}

record Timings(double CpuMs, double ElapsedMs, double ClientMs, double ClientMaxMs);

record StatementResult(
    string Id, string Title, int Rows, long LogicalReads, Dictionary<string, long> ReadsPerTable,
    int Dop, long GrantedMemoryKb, long UsedMemoryKb, bool HasSort, bool HasKeyLookup,
    List<string> Indexes, List<string> Warnings, string PlanTree,
    double CpuMs, double ElapsedMs, double ClientMs, double ClientMaxMs, long? LogBytes);

record IndexSize(string Table, string Index, string Type, long Kb, long Rows);

record RunReport(
    string Label, string DisabledIndex, DateTime TakenAtUtc, Dictionary<string, string> Environment,
    List<IndexSize> IndexSizes, List<StatementResult> Results);
