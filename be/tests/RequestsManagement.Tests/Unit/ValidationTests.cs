using System.ComponentModel.DataAnnotations;
using RequestsManagement.DTO;
using RequestsManagement.DTO.Enums;

namespace RequestsManagement.Tests.Unit;

/// <summary>
/// The input rules are declared on the DTOs (D-18). They are checked here with the same DataAnnotations
/// machinery ASP.NET uses; the integration tests only check that the API answers with the right 400.
/// </summary>
internal static class Validation
{
    /// <summary>The names of the members that failed (empty when the object is valid).</summary>
    public static List<string> FailedMembers(object instance) =>
        Run(instance).SelectMany(r => r.MemberNames).ToList();

    public static List<ValidationResult> Run(object instance)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(instance, new ValidationContext(instance), results, validateAllProperties: true);
        return results;
    }
}

public class RequestFilterValidationTests
{
    [Theory]
    [InlineData(1, 1, true)]
    [InlineData(1, 100, true)]     // the largest allowed page size
    [InlineData(1, 0, false)]
    [InlineData(1, 101, false)]    // above the limit
    [InlineData(0, 20, false)]
    [InlineData(1_000_000, 20, true)]
    [InlineData(1_000_001, 20, false)]
    public void PagingLimits(int page, int pageSize, bool valid)
    {
        var filter = new RequestFilter { Page = page, PageSize = pageSize };

        Assert.Equal(valid, Validation.FailedMembers(filter).Count == 0);
    }

    [Fact]
    public void DefaultFilter_IsValid() => Assert.Empty(Validation.FailedMembers(new RequestFilter()));

    [Fact]
    public void DateRange_StartAfterEnd_IsRejected_SameDayAndOpenRangesAreNot()
    {
        var day = new DateOnly(2026, 5, 1);

        Assert.Contains(nameof(RequestFilter.CreatedFrom),
            Validation.FailedMembers(new RequestFilter { CreatedFrom = day.AddDays(1), CreatedTo = day }));
        Assert.Empty(Validation.FailedMembers(new RequestFilter { CreatedFrom = day, CreatedTo = day }));
        Assert.Empty(Validation.FailedMembers(new RequestFilter { CreatedFrom = day }));
        Assert.Empty(Validation.FailedMembers(new RequestFilter { CreatedTo = day }));
    }

    [Fact]
    public void UndefinedEnumNumbers_AreRejected()
    {
        // Model binding accepts any number for an enum (status=99); the filter must refuse it
        Assert.Contains(nameof(RequestFilter.Status),
            Validation.FailedMembers(new RequestFilter { Status = [RequestStatus.New, (RequestStatus)99] }));
        Assert.Contains(nameof(RequestFilter.Priority),
            Validation.FailedMembers(new RequestFilter { Priority = [(RequestPriority)99] }));
        Assert.Contains(nameof(RequestFilter.SortBy),
            Validation.FailedMembers(new RequestFilter { SortBy = (RequestSortField)99 }));
        Assert.Contains(nameof(RequestFilter.SortDir),
            Validation.FailedMembers(new RequestFilter { SortDir = (SortDirection)99 }));
    }

    [Theory]
    [InlineData(nameof(RequestFilter.Organization), 150, true)]
    [InlineData(nameof(RequestFilter.Organization), 151, false)]
    [InlineData(nameof(RequestFilter.AssignedTo), 100, true)]
    [InlineData(nameof(RequestFilter.AssignedTo), 101, false)]
    [InlineData(nameof(RequestFilter.Search), 100, true)]
    [InlineData(nameof(RequestFilter.Search), 101, false)]
    public void TextFilters_HaveALengthLimit(string member, int length, bool valid)
    {
        var text = new string('x', length);
        var filter = member switch
        {
            nameof(RequestFilter.Organization) => new RequestFilter { Organization = text },
            nameof(RequestFilter.AssignedTo) => new RequestFilter { AssignedTo = text },
            _ => new RequestFilter { Search = text }
        };

        Assert.Equal(valid, Validation.FailedMembers(filter).Count == 0);
    }
}

public class UpdateStatusRequestValidationTests
{
    private const string ValidVersion = "AAAAAAAAB9E="; // 8 bytes, base64

    [Fact]
    public void ValidRequest_IsAccepted() =>
        Assert.Empty(Validation.FailedMembers(new UpdateStatusRequest { NewStatus = RequestStatus.Waiting, Version = ValidVersion }));

    [Fact]
    public void MissingOrUndefinedStatus_IsRejected()
    {
        Assert.Contains(nameof(UpdateStatusRequest.NewStatus),
            Validation.FailedMembers(new UpdateStatusRequest { Version = ValidVersion }));
        Assert.Contains(nameof(UpdateStatusRequest.NewStatus),
            Validation.FailedMembers(new UpdateStatusRequest { NewStatus = (RequestStatus)99, Version = ValidVersion }));
    }

    [Theory]
    [InlineData("")]               // missing
    [InlineData("***")]            // not base64
    [InlineData("AAAA")]           // base64, but 3 bytes
    [InlineData("AAAAAAAAAAAA")]   // base64, but 9 bytes
    public void MissingOrMalformedVersion_IsRejected(string version)
    {
        var request = new UpdateStatusRequest { NewStatus = RequestStatus.Waiting, Version = version };

        Assert.Contains(nameof(UpdateStatusRequest.Version), Validation.FailedMembers(request));
    }
}

public class BulkStatusRequestValidationTests
{
    private const string ValidVersion = "AAAAAAAAB9E=";

    private static List<BulkStatusItem?> Items(int count) =>
        Enumerable.Range(1, count).Select(id => (BulkStatusItem?)new BulkStatusItem { Id = id, Version = ValidVersion }).ToList();

    private static BulkStatusRequest Request(List<BulkStatusItem?>? items, RequestStatus? status = RequestStatus.InProgress) =>
        new() { NewStatus = status, Items = items };

    [Theory]
    [InlineData(1)]
    [InlineData(100)]   // the largest allowed call
    public void OneToHundredItems_AreAccepted(int count) =>
        Assert.Empty(Validation.FailedMembers(Request(Items(count))));

    [Fact]
    public void NoItems_AreRejected()
    {
        Assert.Contains("Items", Validation.FailedMembers(Request(null)));
        Assert.Contains("Items", Validation.FailedMembers(Request([])));
    }

    [Fact]
    public void MoreThanHundredItems_AreRejected() =>
        Assert.Contains("Items", Validation.FailedMembers(Request(Items(101))));

    [Fact]
    public void MissingOrUndefinedStatus_IsRejected()
    {
        Assert.Contains(nameof(BulkStatusRequest.NewStatus), Validation.FailedMembers(Request(Items(1), status: null)));
        Assert.Contains(nameof(BulkStatusRequest.NewStatus), Validation.FailedMembers(Request(Items(1), (RequestStatus)99)));
    }

    [Fact]
    public void RepeatedId_IsRejected_AndOnlyTenIdsAreNamed()
    {
        // 12 ids, each twice: the message names 10 of them, not all (a huge call must not make a huge message)
        var items = Items(12).Concat(Items(12)).ToList();

        var results = Validation.Run(Request(items));

        var message = Assert.Single(results).ErrorMessage!;
        Assert.Contains("1, 2, 3, 4, 5, 6, 7, 8, 9, 10.", message);
        Assert.DoesNotContain("11", message);
    }

    [Fact]
    public void ItemErrors_UseCamelCaseKeysWithTheIndex()
    {
        // Nested attributes would give "items[1].Id"; every key of the API is camelCase (D-18, D-19)
        var items = new List<BulkStatusItem?>
        {
            new() { Id = 5, Version = ValidVersion },
            new() { Id = 0, Version = "***" },
            new() { Id = 7, Version = "" },
            null
        };

        var members = Validation.FailedMembers(Request(items));

        Assert.Equal(
            ["items[1].id", "items[1].version", "items[2].version", "items[3]"],
            members.Order(StringComparer.Ordinal).ToArray());
    }

    [Fact]
    public void NegativeId_IsRejected() =>
        Assert.Contains("items[0].id", Validation.FailedMembers(
            Request([new BulkStatusItem { Id = -5, Version = ValidVersion }])));
}
