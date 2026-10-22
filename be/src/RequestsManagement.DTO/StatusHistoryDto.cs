using RequestsManagement.DTO.Enums;

namespace RequestsManagement.DTO;

/// <summary>One status change of a request (audit row).</summary>
/// <param name="PreviousStatus">Status before the change.</param>
/// <param name="NewStatus">Status after the change.</param>
/// <param name="ChangedAt">When the change was made (UTC).</param>
/// <param name="ChangedBy">User name of the user who made the change (taken from their token).</param>
public record StatusHistoryDto(RequestStatus PreviousStatus, RequestStatus NewStatus, DateTime ChangedAt, string ChangedBy);
