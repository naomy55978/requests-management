using System.Text.Json.Serialization;

namespace RequestsManagement.DTO.Enums;

/// <summary>Fields the requests list can be sorted by (a closed list). The documented values are camelCase, as the client sends them; binding ignores case.</summary>
public enum RequestSortField
{
    [JsonStringEnumMemberName("createdAt")]
    CreatedAt = 1,
    [JsonStringEnumMemberName("updatedAt")]
    UpdatedAt = 2,
    [JsonStringEnumMemberName("priority")]
    Priority = 3,
    [JsonStringEnumMemberName("status")]
    Status = 4,
    [JsonStringEnumMemberName("title")]
    Title = 5
}
