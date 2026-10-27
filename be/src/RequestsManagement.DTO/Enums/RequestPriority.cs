namespace RequestsManagement.DTO.Enums;

/// <summary>
/// Priority of a request. Stored as tinyint.
/// The numeric order matches the business order, so sorting by Priority sorts Low → High.
/// </summary>
public enum RequestPriority : byte
{
    Low = 1,
    Medium = 2,
    High = 3
}
