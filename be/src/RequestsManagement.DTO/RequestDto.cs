using RequestsManagement.DTO.Enums;

namespace RequestsManagement.DTO;

/// <summary>A request, as shown in the list and in the details (same fields in both).</summary>
public record RequestDto(
    int Id,
    string Title,
    string OrganizationName,
    RequestStatus Status,
    RequestPriority Priority,
    string? AssignedTo,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string Version);
// Version is the row version as base64. The client sends it back when it updates the request,
// so the server can detect a concurrent change (optimistic concurrency, M3).
