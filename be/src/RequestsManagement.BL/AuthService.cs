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

    /// <summary>Verifies the password against the stored hash, taking as long for an unknown user as for a wrong password, and logs the attempt without the password.</summary>
    public async Task<AuthenticatedUser?> ValidateCredentialsAsync(
        string userName, string password, CancellationToken cancellationToken)
    {
        var user = await users.FindCredentialsAsync(userName, cancellationToken);

        // An unknown user is checked against the dummy hash, so both answers take the same time
        var result = Hasher.VerifyHashedPassword(user!, user?.PasswordHash ?? DummyHash, password);

        if (user is null || result == PasswordVerificationResult.Failed)
        {
            // Never log the password, not even partially
            logger.LogWarning("Login failed for user name {UserName}", userName);
            return null;
        }

        logger.LogInformation("User {UserName} logged in", user.UserName);
        return new AuthenticatedUser(user.UserName, user.DisplayName);
    }
}
