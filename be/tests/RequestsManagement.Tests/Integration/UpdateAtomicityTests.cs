using System.Net;
using RequestsManagement.DTO.Enums;
using RequestsManagement.Tests.Integration.Infrastructure;

namespace RequestsManagement.Tests.Integration;

/// <summary>
/// The status update and its audit row are one transaction (D-06): if the audit row cannot be written, the
/// update is rolled back. The failure is forced by a CHECK constraint on the history table, so this class has
/// a database of its own (<see cref="IClassFixture{TFixture}"/>, not the shared <see cref="ApiCollection"/>):
/// created for this class and dropped after it, never seen by another test class.
/// </summary>
public class UpdateAtomicityTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    [Fact]
    public async Task WhenTheAuditRowCannotBeWritten_TheStatusUpdateIsRolledBack()
    {
        var request = await fixture.InsertRequestAsync(RequestStatus.New);
        var before = await fixture.GetRequestAsync(request.Id);

        // From now on the database rejects any audit row of this one request
        await fixture.Database.ExecuteAsync(
            $"ALTER TABLE [RequestStatusHistory] WITH NOCHECK ADD CONSTRAINT [CK_Test_RejectAudit] CHECK ([RequestId] <> {request.Id})");
        try
        {
            using var client = fixture.Client();
            var response = await ApiFixture.PatchStatusAsync(client, request.Id, RequestStatus.InProgress, request.Version);

            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        }
        finally
        {
            await fixture.Database.ExecuteAsync("ALTER TABLE [RequestStatusHistory] DROP CONSTRAINT [CK_Test_RejectAudit]");
        }

        // The UPDATE ran before the INSERT failed; none of it may remain
        var after = await fixture.GetRequestAsync(request.Id);
        Assert.Equal(before.Status, after.Status);
        Assert.Equal(before.Version, after.Version);
        Assert.Equal(before.UpdatedAt, after.UpdatedAt);
        Assert.Empty(await fixture.GetHistoryAsync(request.Id));
    }
}
