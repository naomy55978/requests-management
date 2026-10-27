namespace RequestsManagement.DAL.Entities;

/// <summary>Demo user (request handler) who can log in (D-10).</summary>
internal class User
{
    public int Id { get; set; }
    public string UserName { get; set; } = null!;
    public string DisplayName { get; set; } = null!;

    /// <summary>ASP.NET Core Identity password hash (PBKDF2 with a random salt). Never the password itself.</summary>
    public string PasswordHash { get; set; } = "";
}
