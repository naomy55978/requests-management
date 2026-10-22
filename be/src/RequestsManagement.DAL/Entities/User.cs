namespace RequestsManagement.DAL.Entities;

/// <summary>Demo user (request handler) who can log in (D-10).</summary>
internal class User
{
    public int Id { get; set; }
    public string UserName { get; set; } = null!;
    public string DisplayName { get; set; } = null!;

    /// <summary>
    /// ASP.NET Core Identity password hash (PBKDF2 with a random salt). Never the password itself.
    /// Empty for users created before M3 – they cannot log in until the database is re-seeded.
    /// </summary>
    public string PasswordHash { get; set; } = "";
}
