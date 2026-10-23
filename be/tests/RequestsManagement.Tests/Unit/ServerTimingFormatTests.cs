using System.Globalization;
using RequestsManagement.API.Middleware;
using RequestsManagement.DTO.Diagnostics;

namespace RequestsManagement.Tests.Unit;

/// <summary>The Server-Timing header value (D-25) follows the W3C syntax whatever the server's culture.</summary>
public class ServerTimingFormatTests
{
    [Fact]
    public void Format_UsesADecimalPoint_AndReportsTheCacheOnlyWhenKnown()
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            // A culture with a decimal comma: "1,5" would break the header syntax
            CultureInfo.CurrentCulture = new CultureInfo("de-DE");
            var timings = new RequestTimings();
            timings.AddDbCommand(TimeSpan.FromMilliseconds(1.04));

            var withoutCache = ServerTimingMiddleware.Format(TimeSpan.FromMilliseconds(12.46), timings);
            timings.SummaryCache = CacheOutcome.Miss;
            var withCache = ServerTimingMiddleware.Format(TimeSpan.FromMilliseconds(12.46), timings);

            Assert.Equal("total;dur=12.5, db;dur=1.0;desc=\"1 query\"", withoutCache);
            Assert.Equal("total;dur=12.5, db;dur=1.0;desc=\"1 query\", cache;desc=\"miss\"", withCache);
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }
}
