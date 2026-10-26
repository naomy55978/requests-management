using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RequestsManagement.API.Startup;
using RequestsManagement.BL;
using RequestsManagement.DAL;
using RequestsManagement.DTO;

namespace RequestsManagement.Tests.Unit;

/// <summary>
/// The warm-up before the API listens (D-48): it runs only when switched on, asks for the summary once through the
/// normal service, and whatever goes wrong with it, the API still starts.
/// </summary>
public class StartupWarmUpTests
{
    private sealed class FakeRequestService : IRequestService
    {
        public int SummaryCalls { get; private set; }

        /// <summary>What the summary does; by default it answers at once.</summary>
        public Func<CancellationToken, Task<SummaryDto>> OnSummary { get; set; } =
            _ => Task.FromResult(new SummaryDto(0, [], [], []));

        public Task<SummaryDto> GetSummaryAsync(CancellationToken cancellationToken)
        {
            SummaryCalls++;
            return OnSummary(cancellationToken);
        }

        public Task<PagedResult<RequestDto>> GetPageAsync(RequestFilter filter, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<RequestDto?> GetByIdAsync(int id, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<StatusHistoryDto>?> GetHistoryAsync(int id, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<StatusUpdateResult> UpdateStatusAsync(
            int id, UpdateStatusRequest request, string changedBy, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<BulkStatusResponse> BulkUpdateStatusAsync(
            BulkStatusRequest request, string changedBy, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }

    private sealed class RecordingLogger : ILogger
    {
        public List<(LogLevel Level, string Message)> Lines { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Lines.Add((logLevel, formatter(state, exception)));
    }

    private static (IServiceProvider Services, FakeRequestService Service) Build(bool warmUp)
    {
        var service = new FakeRequestService();
        var services = new ServiceCollection()
            .AddSingleton(new DatabaseOptions { WarmUpOnStartup = warmUp })
            .AddScoped<IRequestService>(_ => service)
            .BuildServiceProvider();
        return (services, service);
    }

    [Fact]
    public async Task When_switched_on_it_asks_for_the_summary_once_and_logs_before_and_after()
    {
        var (services, service) = Build(warmUp: true);
        var logger = new RecordingLogger();

        await StartupWarmUp.RunAsync(services, logger, CancellationToken.None);

        Assert.Equal(1, service.SummaryCalls);
        Assert.Equal(2, logger.Lines.Count);
        Assert.All(logger.Lines, line => Assert.Equal(LogLevel.Information, line.Level));
        Assert.Contains("Warming up", logger.Lines[0].Message);
        Assert.Matches(@"Warm-up done in \d+ ms", logger.Lines[1].Message);
    }

    [Fact]
    public async Task When_switched_off_it_does_nothing()
    {
        var (services, service) = Build(warmUp: false);
        var logger = new RecordingLogger();

        await StartupWarmUp.RunAsync(services, logger, CancellationToken.None);

        Assert.Equal(0, service.SummaryCalls);
        Assert.Empty(logger.Lines);
    }

    [Fact]
    public async Task A_failing_warm_up_is_a_warning_and_does_not_stop_the_start()
    {
        var (services, service) = Build(warmUp: true);
        service.OnSummary = _ => throw new InvalidOperationException("database is not reachable");
        var logger = new RecordingLogger();

        await StartupWarmUp.RunAsync(services, logger, CancellationToken.None); // must not throw

        var warning = Assert.Single(logger.Lines, line => line.Level == LogLevel.Warning);
        Assert.Contains("API starts anyway", warning.Message);
        Assert.DoesNotContain(logger.Lines, line => line.Message.StartsWith("Warm-up done"));
    }

    [Fact]
    public async Task A_warm_up_that_takes_too_long_is_given_up_with_a_warning()
    {
        var (services, service) = Build(warmUp: true);
        service.OnSummary = async token =>
        {
            await Task.Delay(Timeout.Infinite, token); // only the time limit ends this
            return new SummaryDto(0, [], [], []);
        };
        var logger = new RecordingLogger();

        await StartupWarmUp.RunAsync(services, logger, CancellationToken.None, timeout: TimeSpan.FromMilliseconds(50));

        Assert.Single(logger.Lines, line => line.Level == LogLevel.Warning);
    }

    [Fact]
    public async Task A_stopping_application_ends_the_warm_up_with_a_warning()
    {
        var (services, service) = Build(warmUp: true);
        service.OnSummary = async token =>
        {
            await Task.Delay(Timeout.Infinite, token);
            return new SummaryDto(0, [], [], []);
        };
        var logger = new RecordingLogger();
        using var stopping = new CancellationTokenSource();
        stopping.CancelAfter(TimeSpan.FromMilliseconds(50));

        // The time limit is far away: if the warm-up ignored the shutdown token it would wait for the limit
        var started = DateTime.UtcNow;
        await StartupWarmUp.RunAsync(services, logger, stopping.Token, timeout: TimeSpan.FromSeconds(30));

        Assert.True(DateTime.UtcNow - started < TimeSpan.FromSeconds(10), "the warm-up waited for the time limit, not for the shutdown");
        Assert.Single(logger.Lines, line => line.Level == LogLevel.Warning);
    }

    [Fact]
    public async Task The_summary_is_requested_in_its_own_scope()
    {
        var scopesSeen = new List<IServiceProvider>();
        var services = new ServiceCollection()
            .AddSingleton(new DatabaseOptions { WarmUpOnStartup = true })
            .AddScoped<IRequestService>(provider =>
            {
                scopesSeen.Add(provider);
                return new FakeRequestService();
            })
            .BuildServiceProvider();

        await StartupWarmUp.RunAsync(services, new RecordingLogger(), CancellationToken.None);

        Assert.Single(scopesSeen);
        Assert.NotSame(services, scopesSeen[0]);
    }
}
