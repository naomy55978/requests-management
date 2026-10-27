using System.Text.Json.Serialization;

namespace RequestsManagement.DTO.Enums;

/// <summary>Sort direction: <c>asc</c> or <c>desc</c> (binding ignores case).</summary>
public enum SortDirection
{
    [JsonStringEnumMemberName("asc")]
    Asc = 1,
    [JsonStringEnumMemberName("desc")]
    Desc = 2
}
