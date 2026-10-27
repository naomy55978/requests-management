using RequestsManagement.DTO.Enums;

namespace RequestsManagement.BL;

/// <summary>
/// The only place that defines which status changes are allowed (D-05).
/// Every update path (single and bulk) uses it; the database update enforces it atomically
/// by updating only rows whose current status is in <see cref="AllowedPrevious"/>.
/// </summary>
/// <remarks>
/// New → InProgress, Waiting · InProgress → Waiting, Completed · Waiting → InProgress, Completed ·
/// Completed is final. A change to the same status is not allowed.
/// </remarks>
public static class StatusTransitions
{
    private static readonly Dictionary<RequestStatus, RequestStatus[]> Next = new()
    {
        [RequestStatus.New] = [RequestStatus.InProgress, RequestStatus.Waiting],
        [RequestStatus.InProgress] = [RequestStatus.Waiting, RequestStatus.Completed],
        [RequestStatus.Waiting] = [RequestStatus.InProgress, RequestStatus.Completed],
        [RequestStatus.Completed] = []
    };

    /// <summary>Whether a request in <paramref name="from"/> may change to <paramref name="to"/>.</summary>
    public static bool IsAllowed(RequestStatus from, RequestStatus to) => AllowedNext(from).Contains(to);

    /// <summary>Statuses a request in <paramref name="from"/> may change to.</summary>
    public static IReadOnlyList<RequestStatus> AllowedNext(RequestStatus from) =>
        Next.TryGetValue(from, out var next) ? next : [];

    /// <summary>Statuses from which a request may change to <paramref name="to"/> (empty for New).</summary>
    public static IReadOnlyList<RequestStatus> AllowedPrevious(RequestStatus to) =>
        Next.Where(pair => pair.Value.Contains(to)).Select(pair => pair.Key).ToArray();
}
