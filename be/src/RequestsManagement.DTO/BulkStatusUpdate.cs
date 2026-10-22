using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using RequestsManagement.DTO.Enums;

namespace RequestsManagement.DTO;

/// <summary>
/// Body of a bulk status change: one new status for up to <see cref="MaxItems"/> requests (D-08).
/// The acting user is never part of the body: the server takes it from the token (D-10).
/// </summary>
public class BulkStatusRequest : IValidatableObject
{
    public const int MaxItems = 100;

    // Listing every duplicate of a huge list would make the error message huge as well
    private const int MaxReportedDuplicates = 10;

    /// <summary>The status every listed request should change to.</summary>
    [Required, EnumDataType(typeof(RequestStatus))]
    public RequestStatus? NewStatus { get; init; }

    /// <summary>The requests to change, 1 to 100, each id at most once.</summary>
    [Required, MinLength(1), MaxLength(MaxItems)]
    public List<BulkStatusItem?>? Items { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Items is null)
        {
            yield break;
        }

        // The items are checked here, not with attributes on BulkStatusItem: errors of nested attributes get a
        // PascalCase key ("items[1].Id"), while every key of this API is camelCase ("items[1].id")
        for (var i = 0; i < Items.Count; i++)
        {
            var item = Items[i];
            if (item is null)
            {
                yield return new ValidationResult("Item must not be null.", [$"items[{i}]"]);
                continue;
            }

            if (item.Id < 1)
            {
                yield return new ValidationResult("Id must be a positive number.", [$"items[{i}].id"]);
            }

            if (string.IsNullOrEmpty(item.Version))
            {
                yield return new ValidationResult("Version is required.", [$"items[{i}].version"]);
            }
            else if (!UpdateStatusRequest.IsValidVersion(item.Version))
            {
                yield return new ValidationResult(
                    "Version must be the base64 'version' value returned by the API.", [$"items[{i}].version"]);
            }
        }

        // The same request twice in one call would race against itself: the second entry always fails
        var duplicates = Items.Where(item => item is not null)
            .GroupBy(item => item!.Id)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .Take(MaxReportedDuplicates)
            .ToList();
        if (duplicates.Count > 0)
        {
            yield return new ValidationResult(
                $"Items must not repeat a request id. Repeated ids: {string.Join(", ", duplicates)}.", ["items"]);
        }
    }
}

/// <summary>One request in a bulk status change, with the version the client read.</summary>
/// <remarks>Validated by <see cref="BulkStatusRequest"/> (see there why).</remarks>
public class BulkStatusItem
{
    /// <summary>Request id (a positive number).</summary>
    public int Id { get; init; }

    /// <summary>
    /// The <c>version</c> of the request as the client last read it (see <see cref="UpdateStatusRequest.Version"/>).
    /// </summary>
    public string Version { get; init; } = "";

    /// <summary>The version as bytes; valid only after validation succeeded.</summary>
    public byte[] GetVersionBytes() => Convert.FromBase64String(Version);
}

/// <summary>Result of one request in a bulk status change (same outcomes and fields as a single change).</summary>
/// <param name="Id">The request id from the call.</param>
/// <param name="Outcome">What happened to this request.</param>
/// <param name="Request">The updated request, with its new version (Updated only).</param>
/// <param name="CurrentStatus">The status in the database (Conflict and InvalidTransition).</param>
/// <param name="CurrentVersion">The version in the database (Conflict and InvalidTransition).</param>
/// <param name="CurrentUpdatedAt">The last change time in the database (Conflict and InvalidTransition).</param>
/// <param name="AllowedStatuses">Statuses the request may change to from its current status (InvalidTransition).</param>
public record BulkStatusItemResult(
    int Id,
    StatusUpdateOutcome Outcome,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RequestDto? Request = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RequestStatus? CurrentStatus = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CurrentVersion = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DateTime? CurrentUpdatedAt = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<RequestStatus>? AllowedStatuses = null);

/// <summary>
/// Answer to a bulk status change. It is always a 200 for a valid body, even if every item failed:
/// each request is its own update (D-08), so read <paramref name="Results"/> for what happened to each one.
/// </summary>
/// <param name="Total">Number of requests in the call.</param>
/// <param name="Succeeded">How many were updated.</param>
/// <param name="Failed">How many were not (NotFound, Conflict or InvalidTransition).</param>
/// <param name="Results">One result per request, in the order of the call.</param>
public record BulkStatusResponse(int Total, int Succeeded, int Failed, IReadOnlyList<BulkStatusItemResult> Results);
