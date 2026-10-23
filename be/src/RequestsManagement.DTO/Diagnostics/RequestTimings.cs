namespace RequestsManagement.DTO.Diagnostics;

/// <summary>
/// Measurements of one HTTP request, reported in the <c>Server-Timing</c> response header (D-23, D-25):
/// time spent in the database and the summary cache outcome. One instance per request (Scoped).
/// </summary>
/// <remarks>
/// Not a DTO: a cross-cutting diagnostics type. It lives in this project because every layer already references
/// it – the DAL records the database time, the BL the cache outcome, and the API writes the header – while the API
/// may reference the DAL only to register it (D-03).
/// Not thread-safe on purpose: the commands of one request run one after the other (a DbContext does not support
/// parallel queries).
/// </remarks>
public sealed class RequestTimings
{
    /// <summary>Total time of the database commands of this request, including reading their rows.</summary>
    public TimeSpan DbTime { get; private set; }

    /// <summary>Number of database commands of this request.</summary>
    public int DbCommands { get; private set; }

    /// <summary>Outcome of the summary cache, or null when the request did not read the summary.</summary>
    public CacheOutcome? SummaryCache { get; set; }

    /// <summary>A database command was executed (for a query: until its first row was available).</summary>
    public void AddDbCommand(TimeSpan executionTime)
    {
        DbTime += executionTime;
        DbCommands++;
    }

    /// <summary>Time spent reading the rows of a query that was already counted by <see cref="AddDbCommand"/>.</summary>
    public void AddDbReadTime(TimeSpan readTime) => DbTime += readTime;
}

public enum CacheOutcome
{
    Hit,
    Miss
}
