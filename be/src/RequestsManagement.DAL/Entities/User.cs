namespace RequestsManagement.DAL.Entities;

/// <summary>
/// Demo user (request handler). The password hash and login logic are added in M3.
/// </summary>
internal class User
{
    public int Id { get; set; }
    public string UserName { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
}
