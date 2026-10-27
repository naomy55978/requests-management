using RequestsManagement.DTO.Enums;

namespace RequestsManagement.DAL.Entities;

// Entities are internal: they never leave the DAL (D-04). Other layers work with DTOs only.
internal class Request
{
    public int Id { get; set; }
    public string Title { get; set; } = null!;
    public string OrganizationName { get; set; } = null!;
    public RequestStatus Status { get; set; }
    public RequestPriority Priority { get; set; }

    /// <summary>UserName of the handling user; null only for New requests that were not assigned yet.</summary>
    public string? AssignedTo { get; set; }

    /// <summary>UTC.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>UTC. Equal to CreatedAt until the first change.</summary>
    public DateTime UpdatedAt { get; set; }

    /// <summary>SQL Server rowversion – changes automatically on every update (optimistic concurrency token).</summary>
    public byte[] RowVersion { get; set; } = null!;

    public ICollection<RequestStatusHistory> StatusHistory { get; set; } = [];
}
