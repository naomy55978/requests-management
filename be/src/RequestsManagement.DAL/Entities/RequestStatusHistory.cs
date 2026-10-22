using RequestsManagement.DTO.Enums;

namespace RequestsManagement.DAL.Entities;

/// <summary>Audit row written for every status change of a request.</summary>
internal class RequestStatusHistory
{
    public int Id { get; set; }
    public int RequestId { get; set; }
    public RequestStatus PreviousStatus { get; set; }
    public RequestStatus NewStatus { get; set; }

    /// <summary>UTC.</summary>
    public DateTime ChangedAt { get; set; }

    /// <summary>UserName of the user who made the change (taken from the JWT on the server, D-10).</summary>
    public string ChangedBy { get; set; } = null!;

    public Request Request { get; set; } = null!;
}
