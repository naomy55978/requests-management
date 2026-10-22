using System.ComponentModel.DataAnnotations;
using RequestsManagement.DTO.Enums;

namespace RequestsManagement.DTO;

/// <summary>
/// Body of a status change. The acting user is never part of the body: the server takes it from the token (D-10).
/// </summary>
public class UpdateStatusRequest : IValidatableObject
{
    // rowversion is 8 bytes
    private const int VersionBytes = 8;

    /// <summary>The new status.</summary>
    [Required, EnumDataType(typeof(RequestStatus))]
    public RequestStatus? NewStatus { get; init; }

    /// <summary>
    /// The <c>version</c> of the request as the client last read it. The update succeeds only if nobody
    /// changed the request since then (optimistic concurrency); otherwise the answer is 409.
    /// </summary>
    [Required]
    public string Version { get; init; } = "";

    /// <summary>The version as bytes; valid only after validation succeeded.</summary>
    public byte[] GetVersionBytes() => Convert.FromBase64String(Version);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!string.IsNullOrEmpty(Version) && !IsValidVersion(Version))
        {
            yield return new ValidationResult(
                "Version must be the base64 'version' value returned by the API.", [nameof(Version)]);
        }
    }

    // Also used by the bulk items, so the format of a version is defined in one place
    internal static bool IsValidVersion(string value)
    {
        Span<byte> buffer = stackalloc byte[VersionBytes + 1];
        return Convert.TryFromBase64String(value, buffer, out var written) && written == VersionBytes;
    }
}

/// <summary>Result of a single status change; bulk updates (M4) report the same outcomes per item (D-08).</summary>
public enum StatusUpdateOutcome
{
    Updated = 1,
    NotFound = 2,

    /// <summary>The request was changed by someone else since the client read it (version mismatch).</summary>
    Conflict = 3,

    /// <summary>The status change is not allowed from the current status (D-05).</summary>
    InvalidTransition = 4
}

/// <param name="Outcome">What happened.</param>
/// <param name="Request">The updated request (Updated only).</param>
/// <param name="CurrentStatus">The status in the database (Conflict and InvalidTransition).</param>
/// <param name="CurrentVersion">The version in the database (Conflict and InvalidTransition).</param>
/// <param name="CurrentUpdatedAt">The last change time in the database (Conflict and InvalidTransition).</param>
/// <param name="AllowedStatuses">Statuses the request may change to from its current status (InvalidTransition).</param>
public record StatusUpdateResult(
    StatusUpdateOutcome Outcome,
    RequestDto? Request = null,
    RequestStatus? CurrentStatus = null,
    string? CurrentVersion = null,
    DateTime? CurrentUpdatedAt = null,
    IReadOnlyList<RequestStatus>? AllowedStatuses = null);
