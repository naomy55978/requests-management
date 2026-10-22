namespace RequestsManagement.DTO.Enums;

/// <summary>Fields the requests list can be sorted by (a closed list, so the client cannot sort by arbitrary columns).</summary>
public enum RequestSortField
{
    CreatedAt = 1,
    UpdatedAt = 2,
    Priority = 3,
    Status = 4,
    Title = 5
}
