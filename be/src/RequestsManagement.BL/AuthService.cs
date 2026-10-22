using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using RequestsManagement.DAL;

namespace RequestsManagement.BL;

/// <summary>A user whose password was verified.</summary>
public record AuthenticatedUser(string UserName, string DisplayName);

public interface IAuthService
{
    /// <returns>The user, or null if the user name or the password is wrong (deliberately not distinguished).</returns>
    Task<AuthenticatedUser?> ValidateCredentialsAsync(string userName, string password, CancellationToken cancellationToken);
}

internal sealed class AuthService(IUserRepository users, ILogger<AuthService> logger) : IAuthService
{
    private static readonly PasswordHasher<UserCredentials> Hasher = new();

    // Verified when the user does not exist, so an unknown user takes as long as a wrong password
    // and response times do not reveal which user names exist
    private static readonly string DummyHash = Hasher.HashPassword(null!, Guid.NewGuid().ToString());

    public async Task<AuthenticatedUser?> ValidateCredentialsAsync(
        string userName, string password, CancellationToken cancellationToken)
    {
        var user = await users.FindCredentialsAsync(userName, cancellationToken);

        // Users seeded before M3 have no hash and can never log in
        var hash = string.IsNullOrEmpty(user?.PasswordHash) ? DummyHash : user.PasswordHash;
        var result = Hasher.VerifyHashedPassword(user!, hash, password);

        if (user is null || hash == DummyHash || result == PasswordVerificationResult.Failed)
        {
            // Never log the password, not even partially
            logger.LogWarning("Login failed for user name {UserName}", userName);
            return null;
        }

        logger.LogInformation("User {UserName} logged in", user.UserName);
        return new AuthenticatedUser(user.UserName, user.DisplayName);
    }
}
