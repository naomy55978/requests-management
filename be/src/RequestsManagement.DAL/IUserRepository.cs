namespace RequestsManagement.DAL;

/// <summary>What the login needs to know about a user. Used only to verify a password.</summary>
public record UserCredentials(string UserName, string DisplayName, string PasswordHash);

public interface IUserRepository
{
    /// <returns>The user's credentials, or null if no user has this user name.</returns>
    Task<UserCredentials?> FindCredentialsAsync(string userName, CancellationToken cancellationToken);
}
