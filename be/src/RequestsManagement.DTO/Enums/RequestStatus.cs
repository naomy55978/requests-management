namespace RequestsManagement.DTO.Enums;

/// <summary>
/// Lifecycle status of a request. Stored as tinyint.
/// Values start at 1 so that the default value (0) is never a valid status.
/// </summary>
public enum RequestStatus : byte
{
    New = 1,
    InProgress = 2,
    Waiting = 3,
    Completed = 4
}
