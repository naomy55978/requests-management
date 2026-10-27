using System.Net;
using RequestsManagement.DTO;
using RequestsManagement.DTO.Enums;
using RequestsManagement.Tests.Integration.Infrastructure;

namespace RequestsManagement.Tests.Integration;

/// <summary>
/// No lost update (D-06): when several callers change the same request with the same version, the database lets
/// exactly one through. The tests do not depend on timing: all calls are released at the same moment and the test
/// checks what must hold whoever wins - one winner, everybody else told about the conflict, one audit row.
/// </summary>
[Collection(ApiCollection.Name)]
public class ConcurrencyTests(ApiFixture fixture)
{
    private const string Dana = "dana.cohen";
    private const string Yossi = "yossi.friedman";

    /// <summary>What happened to one change attempt, whether it was a PATCH or an item of a bulk call.</summary>
    private sealed record Attempt(
        string Kind,
        string User,
        RequestStatus Target,
        StatusUpdateOutcome? Outcome,
        string? NewVersion = null,
        RequestStatus? CurrentStatus = null,
        string? CurrentVersion = null,
        HttpStatusCode? Unexpected = null);

    private static async Task<Attempt> PatchAsync(
        HttpClient client, string user, int id, RequestStatus target, string version)
    {
        var response = await ApiFixture.PatchStatusAsync(client, id, target, version);
        switch (response.StatusCode)
        {
            case HttpStatusCode.OK:
                return new Attempt("PATCH", user, target, StatusUpdateOutcome.Updated, (await response.ReadAsAsync<RequestDto>()).Version);
            case HttpStatusCode.Conflict or HttpStatusCode.UnprocessableEntity:
                var problem = await response.ReadProblemAsync();
                return new Attempt(
                    "PATCH", user, target,
                    response.StatusCode == HttpStatusCode.Conflict ? StatusUpdateOutcome.Conflict : StatusUpdateOutcome.InvalidTransition,
                    CurrentStatus: Enum.Parse<RequestStatus>(problem.GetProperty("currentStatus").GetString()!),
                    CurrentVersion: problem.GetProperty("currentVersion").GetString());
            default:
                return new Attempt("PATCH", user, target, null, Unexpected: response.StatusCode);
        }
    }

    /// <summary>One bulk call; returns its attempts by request id (or one "unexpected" attempt if the call itself failed).</summary>
    private static async Task<List<(int Id, Attempt Attempt)>> BulkAsync(
        HttpClient client, string user, RequestStatus target, IEnumerable<NewRequest> requests)
    {
        var response = await ApiFixture.BulkAsync(client, target, requests.Select(r => (r.Id, r.Version)));
        if (response.StatusCode != HttpStatusCode.OK)
        {
            return [(0, new Attempt("bulk", user, target, null, Unexpected: response.StatusCode))];
        }

        var result = await response.ReadAsAsync<BulkStatusResponse>();
        return result.Results
            .Select(item => (item.Id, new Attempt(
                "bulk", user, target, item.Outcome, item.Request?.Version, item.CurrentStatus, item.CurrentVersion)))
            .ToList();
    }

    /// <summary>What must be true for one request after any race on its original version. Returns the violations (empty = ok).</summary>
    private async Task<List<string>> VerifyAsync(
        NewRequest request, RequestStatus original, IReadOnlyList<Attempt> attempts)
    {
        var problems = new List<string>();
        var label = $"request {request.Id}";

        foreach (var unexpected in attempts.Where(a => a.Outcome is null))
        {
            problems.Add($"{label}: unexpected answer {unexpected.Unexpected} to a {unexpected.Kind} call");
        }

        var winners = attempts.Where(a => a.Outcome == StatusUpdateOutcome.Updated).ToList();
        if (winners.Count != 1)
        {
            problems.Add($"{label}: {winners.Count} attempts succeeded, expected exactly 1");
            return problems;
        }

        var winner = winners[0];
        var row = await fixture.GetRequestAsync(request.Id);
        if (row.Status != winner.Target || row.Version != winner.NewVersion)
        {
            problems.Add($"{label}: database has {row.Status}/{row.Version}, the winner ({winner.Kind} by {winner.User}) wrote {winner.Target}/{winner.NewVersion}");
        }

        var history = await fixture.GetHistoryAsync(request.Id);
        if (history.Count != 1)
        {
            problems.Add($"{label}: {history.Count} audit rows, expected exactly 1");
        }
        else if (history[0] != new DbHistoryRow(original, winner.Target, row.UpdatedAt, winner.User))
        {
            problems.Add($"{label}: audit row {history[0]} is not the winner's change ({original} -> {winner.Target} by {winner.User} at {row.UpdatedAt:O})");
        }

        foreach (var loser in attempts.Where(a => a != winner && a.Outcome is not null))
        {
            switch (loser.Outcome)
            {
                case StatusUpdateOutcome.Conflict:
                    // Told about the state the winner left behind
                    if (loser.CurrentStatus != row.Status || loser.CurrentVersion != row.Version)
                    {
                        problems.Add($"{label}: a conflict reported {loser.CurrentStatus}/{loser.CurrentVersion}, the database has {row.Status}/{row.Version}");
                    }

                    break;
                case StatusUpdateOutcome.InvalidTransition:
                    // Only possible for a change that was never allowed from the original status, and decided
                    // while the original version was still current
                    if (StatusTransitionsAllow(original, loser.Target) ||
                        loser.CurrentStatus != original || loser.CurrentVersion != request.Version)
                    {
                        problems.Add($"{label}: {loser.Kind} by {loser.User} to {loser.Target} was answered 'not allowed' ({loser.CurrentStatus})");
                    }

                    break;
                default:
                    problems.Add($"{label}: a losing attempt was answered {loser.Outcome}");
                    break;
            }
        }

        return problems;
    }

    private static bool StatusTransitionsAllow(RequestStatus from, RequestStatus to) =>
        RequestsManagement.BL.StatusTransitions.IsAllowed(from, to);

    [Fact]
    public async Task ParallelUpdatesWithTheSameVersion_ExactlyOneSucceeds_NoLostUpdate()
    {
        // 10 requests x 20 simultaneous PATCH calls, all with the version the request had before.
        // Two users, and two different target statuses, so a lost update would change the final status silently.
        const int requestCount = 10, callsPerRequest = 20;
        var requests = await fixture.InsertRequestsAsync(requestCount, RequestStatus.InProgress);
        using var dana = fixture.Client(Dana);
        using var yossi = fixture.Client(Yossi);
        var gate = new TaskCompletionSource();

        var calls = requests.Select(request => (request, attempts: Enumerable.Range(0, callsPerRequest).Select(j =>
            Task.Run(async () =>
            {
                await gate.Task;
                var (client, user) = j % 2 == 0 ? (dana, Dana) : (yossi, Yossi);
                var target = (j / 2) % 2 == 0 ? RequestStatus.Waiting : RequestStatus.Completed;
                return await PatchAsync(client, user, request.Id, target, request.Version);
            })).ToList())).ToList();

        gate.SetResult();   // everything starts now
        var problems = new List<string>();
        foreach (var (request, attempts) in calls)
        {
            var results = await Task.WhenAll(attempts);
            Assert.Equal(callsPerRequest - 1, results.Count(a => a.Outcome == StatusUpdateOutcome.Conflict));
            problems.AddRange(await VerifyAsync(request, RequestStatus.InProgress, results));
        }

        Assert.True(problems.Count == 0, string.Join(Environment.NewLine, problems));
    }

    [Fact]
    public async Task BulkCallsRacingSinglePatchCalls_ExactlyOneChangePerRequest_NoServerErrors()
    {
        // The same requests are changed at the same moment by two bulk calls (one in reverse order, which would
        // deadlock if a bulk call held several rows at once) and by three PATCH calls per request.
        const int requestCount = 20;
        var inProgress = await fixture.InsertRequestsAsync(requestCount / 2, RequestStatus.InProgress);
        var waiting = await fixture.InsertRequestsAsync(requestCount / 2, RequestStatus.Waiting);
        var requests = inProgress.Concat(waiting).ToList();
        var original = requests.ToDictionary(r => r.Id, r => inProgress.Contains(r) ? RequestStatus.InProgress : RequestStatus.Waiting);
        using var dana = fixture.Client(Dana);
        using var yossi = fixture.Client(Yossi);
        var gate = new TaskCompletionSource();

        Task<List<(int Id, Attempt Attempt)>> Bulk(HttpClient client, string user, RequestStatus target, IEnumerable<NewRequest> items) =>
            Task.Run(async () => { await gate.Task; return await BulkAsync(client, user, target, items); });

        var bulkCalls = new[]
        {
            Bulk(dana, Dana, RequestStatus.Completed, requests),                    // valid from both original statuses
            Bulk(yossi, Yossi, RequestStatus.Waiting, requests.AsEnumerable().Reverse())   // valid only from InProgress
        };
        var singleCalls = requests.Select(request => (request, calls: new[]
        {
            (yossi, Yossi, original[request.Id] == RequestStatus.InProgress ? RequestStatus.Waiting : RequestStatus.InProgress),
            (dana, Dana, RequestStatus.Completed),
            (yossi, Yossi, RequestStatus.Completed)
        }.Select(c => Task.Run(async () =>
        {
            await gate.Task;
            return await PatchAsync(c.Item1, c.Item2, request.Id, c.Item3, request.Version);
        })).ToList())).ToList();

        gate.SetResult();
        var attemptsByRequest = requests.ToDictionary(r => r.Id, _ => new List<Attempt>());
        var problems = new List<string>();
        foreach (var bulkResult in await Task.WhenAll(bulkCalls))
        {
            foreach (var (id, attempt) in bulkResult)
            {
                if (id == 0)
                {
                    problems.Add($"a bulk call failed as a whole: {attempt.Unexpected}");
                }
                else
                {
                    attemptsByRequest[id].Add(attempt);
                }
            }
        }

        foreach (var (request, calls) in singleCalls)
        {
            attemptsByRequest[request.Id].AddRange(await Task.WhenAll(calls));
        }

        foreach (var request in requests)
        {
            problems.AddRange(await VerifyAsync(request, original[request.Id], attemptsByRequest[request.Id]));
        }

        Assert.True(problems.Count == 0, string.Join(Environment.NewLine, problems.Take(10)));
    }
}
