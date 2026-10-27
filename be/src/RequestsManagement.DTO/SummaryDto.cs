using RequestsManagement.DTO.Enums;

namespace RequestsManagement.DTO;

/// <summary>Aggregations shown on the summary cards.</summary>
/// <param name="Total">All requests.</param>
/// <param name="ByStatus">Request count per status (every status is listed, also with 0).</param>
/// <param name="ByPriority">Request count per priority (every priority is listed, also with 0).</param>
/// <param name="TopOrganizations">Organizations with the most open requests (not Completed), largest first.</param>
public record SummaryDto(
    int Total,
    IReadOnlyList<StatusCountDto> ByStatus,
    IReadOnlyList<PriorityCountDto> ByPriority,
    IReadOnlyList<OrganizationCountDto> TopOrganizations);

public record StatusCountDto(RequestStatus Status, int Count);

public record PriorityCountDto(RequestPriority Priority, int Count);

public record OrganizationCountDto(string OrganizationName, int OpenRequests);
