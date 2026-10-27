using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace RequestsManagement.API.Auth;

/// <summary>JWT settings, bound from the "Jwt" configuration section.</summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    // HS256 needs a key of at least 256 bits
    private const int MinKeyBytes = 32;

    public string Issuer { get; init; } = "";
    public string Audience { get; init; } = "";

    /// <summary>
    /// Symmetric signing key. Only appsettings.Development.json contains one (a development key);
    /// any other environment must supply it from a secret store or the Jwt__SigningKey variable.
    /// </summary>
    public string SigningKey { get; init; } = "";

    public int LifetimeMinutes { get; init; } = 480;

    public SymmetricSecurityKey GetSigningKey() => new(Encoding.UTF8.GetBytes(SigningKey));

    /// <summary>Fails at startup instead of at the first login if the settings are missing or too weak.</summary>
    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Issuer) || string.IsNullOrWhiteSpace(Audience))
        {
            throw new InvalidOperationException("Jwt:Issuer and Jwt:Audience must be configured.");
        }

        if (Encoding.UTF8.GetByteCount(SigningKey) < MinKeyBytes)
        {
            throw new InvalidOperationException(
                $"Jwt:SigningKey must be configured with at least {MinKeyBytes} bytes " +
                "(set it with user-secrets or the Jwt__SigningKey environment variable).");
        }

        if (LifetimeMinutes <= 0)
        {
            throw new InvalidOperationException("Jwt:LifetimeMinutes must be positive.");
        }
    }
}
