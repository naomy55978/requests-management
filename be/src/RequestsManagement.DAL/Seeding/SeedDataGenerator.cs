using RequestsManagement.DAL.Entities;
using RequestsManagement.DTO.Enums;

namespace RequestsManagement.DAL.Seeding;

internal sealed record SeedData(
    IReadOnlyList<User> Users,
    IReadOnlyList<Request> Requests,
    IReadOnlyList<RequestStatusHistory> History);

/// <summary>
/// Generates deterministic demo data (D-13): the same request count always produces exactly the same rows,
/// so performance measurements are comparable between runs and machines.
/// Determinism relies on a fixed Random seed, a fixed anchor date (never DateTime.UtcNow) and
/// a single, fixed order of Random calls.
/// </summary>
internal static class SeedDataGenerator
{
    public const int RandomSeed = 20261022;

    /// <summary>All generated dates lie before this fixed point in time (UTC).</summary>
    public static readonly DateTime AnchorDate = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    private const int DaysBack = 730;          // CreatedAt spread over ~2 years
    private const int OrganizationCount = 400;
    private const double OrganizationSkew = 0.5;  // Zipf exponent: a few large organizations, a long tail of small ones
    private const double UnassignedNewShare = 0.5;
    private static readonly TimeSpan MaxHandlingTime = TimeSpan.FromDays(60);

    public static SeedData Generate(int requestCount)
    {
        var random = new Random(RandomSeed);

        var users = CreateUsers();
        var organizations = CreateOrganizations(random);

        var organizationPicker = new WeightedPicker(
            Enumerable.Range(1, organizations.Count).Select(rank => 1.0 / Math.Pow(rank, OrganizationSkew)));
        // Mild workload differences between handlers (weights 1.0–1.6)
        var userPicker = new WeightedPicker(Enumerable.Range(0, users.Count).Select(i => 1.0 + i % 5 * 0.15));
        var priorityPicker = new WeightedPicker([30, 50, 20]);  // Low, Medium, High

        var requests = new List<Request>(requestCount);
        var history = new List<RequestStatusHistory>(requestCount * 2);

        for (var id = 1; id <= requestCount; id++)
        {
            var createdAt = AnchorDate.Date
                .AddDays(-(1 + random.Next(DaysBack)))
                .AddSeconds(8 * 3600 + random.Next(10 * 3600));  // business hours 08:00–18:00

            var status = PickStatus(random, (AnchorDate - createdAt).TotalDays);
            var priority = (RequestPriority)(priorityPicker.Pick(random) + 1);
            var organization = organizations[organizationPicker.Pick(random)];

            string? assignedTo = status == RequestStatus.New && random.NextDouble() < UnassignedNewShare
                ? null
                : users[userPicker.Pick(random)].UserName;

            var title = string.Format(
                SeedWordLists.TitleTemplates[random.Next(SeedWordLists.TitleTemplates.Length)],
                SeedWordLists.TitleSubjects[random.Next(SeedWordLists.TitleSubjects.Length)])
                + SeedWordLists.TitleContexts[random.Next(SeedWordLists.TitleContexts.Length)];
            title = char.ToUpperInvariant(title[0]) + title[1..];

            // Status changes from New to the final status; each change becomes one history row
            var path = BuildStatusPath(random, status);
            var changeTimes = BuildChangeTimes(random, createdAt, path.Length);
            var updatedAt = changeTimes.Length > 0 ? changeTimes[^1] : createdAt;

            requests.Add(new Request
            {
                Id = id,
                Title = title,
                OrganizationName = organization,
                Status = status,
                Priority = priority,
                AssignedTo = assignedTo,
                CreatedAt = createdAt,
                UpdatedAt = updatedAt
            });

            var previous = RequestStatus.New;
            for (var i = 0; i < path.Length; i++)
            {
                history.Add(new RequestStatusHistory
                {
                    Id = history.Count + 1,
                    RequestId = id,
                    PreviousStatus = previous,
                    NewStatus = path[i],
                    ChangedAt = changeTimes[i],
                    ChangedBy = assignedTo!  // only New requests can be unassigned, and they have no history
                });
                previous = path[i];
            }
        }

        return new SeedData(users, requests, history);
    }

    private static List<User> CreateUsers()
    {
        var users = new List<User>(SeedWordLists.FirstNames.Length);
        for (var i = 0; i < SeedWordLists.FirstNames.Length; i++)
        {
            var first = SeedWordLists.FirstNames[i];
            var last = SeedWordLists.LastNames[i * 7 % SeedWordLists.LastNames.Length];
            users.Add(new User
            {
                Id = i + 1,
                UserName = $"{first}.{last}".ToLowerInvariant(),
                DisplayName = $"{first} {last}"
            });
        }
        return users;
    }

    private static List<string> CreateOrganizations(Random random)
    {
        var names = new List<string>(OrganizationCount);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        while (names.Count < OrganizationCount)
        {
            var name = $"{SeedWordLists.OrganizationPrefixes[random.Next(SeedWordLists.OrganizationPrefixes.Length)]} " +
                       $"{SeedWordLists.OrganizationSectors[random.Next(SeedWordLists.OrganizationSectors.Length)]} " +
                       $"{SeedWordLists.OrganizationSuffixes[random.Next(SeedWordLists.OrganizationSuffixes.Length)]}";
            if (seen.Add(name))
            {
                names.Add(name);
            }
        }
        return names;
    }

    /// <summary>
    /// Older requests are more likely to be completed, recent ones more likely to be new or in progress.
    /// </summary>
    private static RequestStatus PickStatus(Random random, double ageDays)
    {
        // Weights for New, InProgress, Waiting, Completed
        int[] weights = ageDays switch
        {
            < 30 => [45, 30, 15, 10],
            < 180 => [20, 25, 15, 40],
            _ => [4, 14, 10, 72]
        };

        var roll = random.Next(100);
        for (var i = 0; i < weights.Length; i++)
        {
            if (roll < weights[i])
            {
                return (RequestStatus)(i + 1);
            }
            roll -= weights[i];
        }
        throw new InvalidOperationException("Status weights must sum to 100.");
    }

    /// <summary>
    /// Status changes from New to <paramref name="finalStatus"/>, using only transitions allowed by D-05.
    /// </summary>
    private static RequestStatus[] BuildStatusPath(Random random, RequestStatus finalStatus)
    {
        var roll = random.NextDouble();
        return finalStatus switch
        {
            RequestStatus.New => [],
            RequestStatus.InProgress => roll < 0.7
                ? [RequestStatus.InProgress]
                : [RequestStatus.Waiting, RequestStatus.InProgress],
            RequestStatus.Waiting => roll < 0.6
                ? [RequestStatus.Waiting]
                : [RequestStatus.InProgress, RequestStatus.Waiting],
            RequestStatus.Completed => roll switch
            {
                < 0.60 => [RequestStatus.InProgress, RequestStatus.Completed],
                < 0.85 => [RequestStatus.InProgress, RequestStatus.Waiting, RequestStatus.Completed],
                _ => [RequestStatus.Waiting, RequestStatus.Completed]
            },
            _ => throw new ArgumentOutOfRangeException(nameof(finalStatus))
        };
    }

    /// <summary>
    /// Increasing change times after <paramref name="createdAt"/>: at least one hour, at most 60 days later,
    /// never after the anchor date. The last change time becomes UpdatedAt.
    /// </summary>
    private static DateTime[] BuildChangeTimes(Random random, DateTime createdAt, int changeCount)
    {
        if (changeCount == 0)
        {
            return [];
        }

        var maxSpan = Math.Min(MaxHandlingTime.TotalSeconds, (AnchorDate - createdAt).TotalSeconds);
        var span = random.Next(3600, (int)maxSpan);

        var offsets = new int[changeCount];
        for (var i = 0; i < changeCount - 1; i++)
        {
            offsets[i] = random.Next(1, span);
        }
        offsets[^1] = span;
        Array.Sort(offsets);

        // Keep the order strict even if two random offsets collide
        for (var i = 1; i < offsets.Length; i++)
        {
            offsets[i] = Math.Max(offsets[i], offsets[i - 1] + 1);
        }

        return offsets.Select(seconds => createdAt.AddSeconds(seconds)).ToArray();
    }

    /// <summary>Picks an index with probability proportional to its weight.</summary>
    private sealed class WeightedPicker
    {
        private readonly double[] _cumulative;

        public WeightedPicker(IEnumerable<double> weights)
        {
            var total = 0.0;
            _cumulative = weights.Select(w => total += w).ToArray();
        }

        public int Pick(Random random)
        {
            var index = Array.BinarySearch(_cumulative, random.NextDouble() * _cumulative[^1]);
            return index >= 0 ? index : ~index;
        }
    }
}
