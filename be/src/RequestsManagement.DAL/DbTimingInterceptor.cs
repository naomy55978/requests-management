using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RequestsManagement.DTO.Diagnostics;

namespace RequestsManagement.DAL;

/// <summary>
/// Adds the duration of every database command to the request's <see cref="RequestTimings"/> (Server-Timing, D-25).
/// EF Core measures the durations itself; this only collects them.
/// </summary>
internal sealed class DbTimingInterceptor(RequestTimings timings) : DbCommandInterceptor
{
    // Queries in two parts: ReaderExecuted reports the execution (until the first row is available), and
    // DataReaderDisposing only the time from opening the reader to disposing it (reading the rows) – measured:
    // a 240 ms search was 236 ms execution and 3 ms reading, so neither event alone is the database time.
    public override DbDataReader ReaderExecuted(DbCommand command, CommandExecutedEventData eventData, DbDataReader result)
    {
        timings.AddDbCommand(eventData.Duration);
        return result;
    }

    public override ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, DbDataReader result, CancellationToken cancellationToken = default)
    {
        timings.AddDbCommand(eventData.Duration);
        return ValueTask.FromResult(result);
    }

    public override InterceptionResult DataReaderDisposing(
        DbCommand command, DataReaderDisposingEventData eventData, InterceptionResult result)
    {
        timings.AddDbReadTime(eventData.Duration);
        return result;
    }

    // Commands without a reader (INSERT / raw SQL)
    public override ValueTask<int> NonQueryExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        timings.AddDbCommand(eventData.Duration);
        return ValueTask.FromResult(result);
    }

    public override int NonQueryExecuted(DbCommand command, CommandExecutedEventData eventData, int result)
    {
        timings.AddDbCommand(eventData.Duration);
        return result;
    }

    public override ValueTask<object?> ScalarExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, object? result, CancellationToken cancellationToken = default)
    {
        timings.AddDbCommand(eventData.Duration);
        return ValueTask.FromResult(result);
    }

    public override object? ScalarExecuted(DbCommand command, CommandExecutedEventData eventData, object? result)
    {
        timings.AddDbCommand(eventData.Duration);
        return result;
    }

    // A failed command (e.g. a timeout) took time as well
    public override Task CommandFailedAsync(
        DbCommand command, CommandErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        timings.AddDbCommand(eventData.Duration);
        return Task.CompletedTask;
    }

    public override void CommandFailed(DbCommand command, CommandErrorEventData eventData) =>
        timings.AddDbCommand(eventData.Duration);
}
