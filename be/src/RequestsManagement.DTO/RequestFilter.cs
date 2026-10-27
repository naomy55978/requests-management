using System.ComponentModel.DataAnnotations;
using RequestsManagement.DTO.Enums;

namespace RequestsManagement.DTO;

/// <summary>
/// Query parameters of the requests list: paging, combined filters, text search and sorting.
/// Validation rules are declared here (DataAnnotations, D-18) and enforced by ASP.NET model validation,
/// so every invalid input is answered with the same ValidationProblemDetails format.
/// </summary>
public class RequestFilter : IValidatableObject
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    // Keeps (Page - 1) * PageSize far below int.MaxValue (it is used as the SQL OFFSET)
    public const int MaxPage = 1_000_000;

    /// <summary>Value of <see cref="AssignedTo"/> that selects requests without a handler.</summary>
    public const string Unassigned = "unassigned";

    /// <summary>1-based page number.</summary>
    [Range(1, MaxPage)]
    public int Page { get; init; } = 1;

    /// <summary>Items per page (1 to 100).</summary>
    [Range(1, MaxPageSize)]
    public int PageSize { get; init; } = DefaultPageSize;

    /// <summary>Only requests with one of these statuses. Repeat the parameter: status=New&amp;status=Waiting.</summary>
    public RequestStatus[]? Status { get; init; }

    /// <summary>Only requests with one of these priorities. Repeat the parameter: priority=High&amp;priority=Medium.</summary>
    public RequestPriority[]? Priority { get; init; }

    /// <summary>Only requests of organizations whose name starts with this text.</summary>
    [StringLength(150)]
    public string? Organization { get; init; }

    /// <summary>
    /// Only requests whose handler's user name starts with this text (the full name matches too).
    /// The special value <c>unassigned</c> (a keyword, not a prefix) returns only requests that have no handler yet.
    /// </summary>
    [StringLength(100)]
    public string? AssignedTo { get; init; }

    /// <summary>First creation day to include (UTC, inclusive).</summary>
    public DateOnly? CreatedFrom { get; init; }

    /// <summary>Last creation day to include (UTC, the whole day is included).</summary>
    public DateOnly? CreatedTo { get; init; }

    /// <summary>Text contained in the title or in the organization name.</summary>
    [StringLength(100)]
    public string? Search { get; init; }

    /// <summary>Sort field. Default: CreatedAt.</summary>
    [EnumDataType(typeof(RequestSortField))]
    public RequestSortField SortBy { get; init; } = RequestSortField.CreatedAt;

    /// <summary>Sort direction. Default: Desc.</summary>
    [EnumDataType(typeof(SortDirection))]
    public SortDirection SortDir { get; init; } = SortDirection.Desc;

    // Rules that attributes cannot express: cross-field and per-element checks.
    // Model binding accepts any number for an enum (status=99), so undefined values are rejected here.
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (CreatedFrom > CreatedTo)
        {
            yield return new ValidationResult(
                "CreatedFrom must not be later than CreatedTo.", [nameof(CreatedFrom), nameof(CreatedTo)]);
        }

        if (Status?.Any(s => !Enum.IsDefined(s)) == true)
        {
            yield return new ValidationResult(
                "Status contains an undefined value. Allowed: New, InProgress, Waiting, Completed.", [nameof(Status)]);
        }

        if (Priority?.Any(p => !Enum.IsDefined(p)) == true)
        {
            yield return new ValidationResult(
                "Priority contains an undefined value. Allowed: Low, Medium, High.", [nameof(Priority)]);
        }
    }
}
