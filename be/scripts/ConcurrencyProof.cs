// File-based apps are Native AOT by default, which disables reflection-based JSON; a test script does not need AOT
#:property PublishAot=false

// Concurrency proof: no lost update (optimistic concurrency, D-06).
//
// Run against a running API (Development, seeded database):
//   dotnet run scripts/ConcurrencyProof.cs
//   dotnet run scripts/ConcurrencyProof.cs -- --base-url http://localhost:5084 --requests 50 --parallel 20
//
// For each of N requests it sends P PATCH /status calls AT THE SAME TIME, all with the same version,
// from two different users and with different target statuses. Expected for every request:
//   * exactly one 200 and P-1 times 409 (nothing else, no 5xx);
//   * exactly one new history row, written by the winner's user, previous status = the status before;
//   * the final status and version are the winner's; UpdatedAt = ChangedAt of that history row;
//   * every 409 reports the final status and version.
// Then a sequential "stale version" scenario: A updates with V (200, V2), B updates with V (409, current V2),
// B retries with V2 (200 or 422).
// Only the public API is used, so the same checks can become the automated test in M6 (#29).
// Every run picks requests that were not changed for the longest time, so it can be repeated.

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

var baseUrl = Arg("--base-url", "http://localhost:5084");
var requestCount = int.Parse(Arg("--requests", "50"));
var parallel = int.Parse(Arg("--parallel", "20"));

// Demo users from the seed; all share the documented demo password
const string Password = "Demo123!";
string[] userNames = ["dana.cohen", "yossi.friedman"];

// Allowed transitions (D-05) – needed only to choose valid targets; the API remains the authority
var allowedNext = new Dictionary<string, string[]>
{
    ["New"] = ["InProgress", "Waiting"],
    ["InProgress"] = ["Waiting", "Completed"],
    ["Waiting"] = ["InProgress", "Completed"]
};

var json = new JsonSerializerOptions(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
using var http = new HttpClient { BaseAddress = new Uri(baseUrl), Timeout = TimeSpan.FromSeconds(60) };

var tokens = new Dictionary<string, string>();
foreach (var user in userNames)
{
    var login = await http.PostAsJsonAsync("/api/auth/login", new { userName = user, password = Password });
    login.EnsureSuccessStatusCode();
    tokens[user] = (await login.Content.ReadFromJsonAsync<LoginResponse>(json))!.AccessToken;
}

var failures = new List<string>();
int totalOk = 0, totalConflict = 0, totalOther = 0;

// Requests with two possible next statuses, oldest change first (re-runs pick fresh ones)
var page = await Get<PagedResult>(
    $"/api/requests?status=InProgress&status=Waiting&sortBy=updatedAt&sortDir=Asc&pageSize={requestCount}");
Console.WriteLine($"Concurrency proof against {baseUrl}: {page.Items.Count} requests x {parallel} parallel PATCH calls\n");

foreach (var item in page.Items)
{
    var before = await Get<RequestDto>($"/api/requests/{item.Id}");
    var historyBefore = await Get<List<HistoryDto>>($"/api/requests/{item.Id}/history");
    var targets = allowedNext[before.Status];

    // Build all calls first, then release them together, so they really hit the server at the same time
    var start = new TaskCompletionSource();
    var calls = Enumerable.Range(0, parallel).Select(async i =>
    {
        // Independent choices, so every user/target combination competes
        var user = userNames[i % userNames.Length];
        var target = targets[i / userNames.Length % targets.Length];
        await start.Task;
        var response = await Send(HttpMethod.Patch, $"/api/requests/{item.Id}/status", user,
            new { newStatus = target, version = before.Version });
        return (User: user, Target: target, Response: response, Body: await response.Content.ReadAsStringAsync());
    }).ToList();
    start.SetResult();
    var results = await Task.WhenAll(calls);

    var ok = results.Where(r => r.Response.StatusCode == HttpStatusCode.OK).ToList();
    var conflicts = results.Where(r => r.Response.StatusCode == HttpStatusCode.Conflict).ToList();
    var other = results.Length - ok.Count - conflicts.Count;
    totalOk += ok.Count;
    totalConflict += conflicts.Count;
    totalOther += other;

    var after = await Get<RequestDto>($"/api/requests/{item.Id}");
    var historyAfter = await Get<List<HistoryDto>>($"/api/requests/{item.Id}/history");
    var newRows = historyAfter.Count - historyBefore.Count;

    var problems = new List<string>();
    if (ok.Count != 1) problems.Add($"{ok.Count} x 200 (expected exactly 1)");
    if (other != 0) problems.Add($"{other} responses other than 200/409: " +
        string.Join(", ", results.Where(r => r.Response.StatusCode is not (HttpStatusCode.OK or HttpStatusCode.Conflict))
            .Select(r => (int)r.Response.StatusCode).Distinct()));
    if (newRows != 1) problems.Add($"{newRows} new history rows (expected exactly 1)");

    if (ok.Count == 1 && newRows == 1)
    {
        var winner = ok[0];
        var updated = JsonSerializer.Deserialize<RequestDto>(winner.Body, json)!;
        var last = historyAfter[^1];

        if (after.Status != winner.Target) problems.Add($"final status {after.Status}, winner set {winner.Target} (lost update!)");
        if (after.Version != updated.Version) problems.Add("final version differs from the winner's response");
        if (after.Version == before.Version) problems.Add("version did not change");
        if (last.ChangedBy != winner.User) problems.Add($"history ChangedBy {last.ChangedBy}, winner was {winner.User}");
        if (last.PreviousStatus != before.Status || last.NewStatus != winner.Target)
            problems.Add($"history row {last.PreviousStatus}->{last.NewStatus}, expected {before.Status}->{winner.Target}");
        if (last.ChangedAt != after.UpdatedAt) problems.Add($"UpdatedAt {after.UpdatedAt:O} != ChangedAt {last.ChangedAt:O}");

        foreach (var conflict in conflicts)
        {
            var body = JsonSerializer.Deserialize<JsonElement>(conflict.Body);
            if (body.GetProperty("currentVersion").GetString() != after.Version ||
                body.GetProperty("currentStatus").GetString() != after.Status)
            {
                problems.Add("a 409 did not report the final status/version");
                break;
            }
        }
    }

    var line = $"#{item.Id,-6} {before.Status,-10} -> {(ok.Count == 1 ? ok[0].Target : "?"),-10} " +
               $"by {(ok.Count == 1 ? ok[0].User : "?"),-15} 200 x{ok.Count}  409 x{conflicts.Count}  history +{newRows}";
    Console.WriteLine(problems.Count == 0 ? $"PASS {line}" : $"FAIL {line}  -> {string.Join("; ", problems)}");
    if (problems.Count > 0) failures.Add($"#{item.Id}: {string.Join("; ", problems)}");
}

// ---- Stale version, step by step ----
Console.WriteLine("\nStale version scenario:");
var stale = (await Get<PagedResult>("/api/requests?status=New&sortBy=updatedAt&sortDir=Asc&pageSize=1")).Items[0];
var a = await Send(HttpMethod.Patch, $"/api/requests/{stale.Id}/status", userNames[0], new { newStatus = "InProgress", version = stale.Version });
var v2 = (await a.Content.ReadFromJsonAsync<RequestDto>(json))?.Version;
var b = await Send(HttpMethod.Patch, $"/api/requests/{stale.Id}/status", userNames[1], new { newStatus = "Waiting", version = stale.Version });
var bBody = JsonSerializer.Deserialize<JsonElement>(await b.Content.ReadAsStringAsync());
var retry = await Send(HttpMethod.Patch, $"/api/requests/{stale.Id}/status", userNames[1], new { newStatus = "Waiting", version = v2 });
Check($"A with V          -> {(int)a.StatusCode} (expected 200)", a.StatusCode == HttpStatusCode.OK);
Check($"B with the same V -> {(int)b.StatusCode} (expected 409, currentVersion = A's new version)",
    b.StatusCode == HttpStatusCode.Conflict && bBody.GetProperty("currentVersion").GetString() == v2);
Check($"B retries with V2 -> {(int)retry.StatusCode} (expected 200: InProgress -> Waiting)", retry.StatusCode == HttpStatusCode.OK);

Console.WriteLine($"\nTotal: {totalOk} x 200, {totalConflict} x 409, {totalOther} other, in {page.Items.Count} rounds of {parallel}.");
Console.WriteLine(failures.Count == 0 ? "NO LOST UPDATE – ALL CHECKS PASSED" : $"{failures.Count} FAILURE(S):\n  " + string.Join("\n  ", failures));
return failures.Count == 0 ? 0 : 1;

// ---- helpers ----
void Check(string label, bool ok)
{
    Console.WriteLine($"{(ok ? "PASS" : "FAIL")} {label}");
    if (!ok) failures.Add(label);
}

async Task<HttpResponseMessage> Send(HttpMethod method, string url, string user, object? body = null)
{
    using var message = new HttpRequestMessage(method, url);
    message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokens[user]);
    if (body is not null) message.Content = JsonContent.Create(body);
    var response = await http.SendAsync(message);
    await response.Content.LoadIntoBufferAsync();
    return response;
}

async Task<T> Get<T>(string url)
{
    var response = await Send(HttpMethod.Get, url, userNames[0]);
    response.EnsureSuccessStatusCode();
    return (await response.Content.ReadFromJsonAsync<T>(json))!;
}

string Arg(string name, string fallback)
{
    var i = Array.IndexOf(args, name);
    return i >= 0 && i + 1 < args.Length ? args[i + 1] : fallback;
}

record LoginResponse(string AccessToken);
record RequestDto(int Id, string Status, DateTime UpdatedAt, string Version);
record PagedResult(List<RequestDto> Items);
record HistoryDto(string PreviousStatus, string NewStatus, DateTime ChangedAt, string ChangedBy);
