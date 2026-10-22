using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using RequestsManagement.BL;
using RequestsManagement.DTO;

namespace RequestsManagement.API.Auth;

/// <summary>Issues signed access tokens. The token is the only source of the acting user (D-10).</summary>
public sealed class JwtTokenService(JwtOptions options, TimeProvider timeProvider)
{
    public LoginResponse CreateToken(AuthenticatedUser user)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var expiresAt = now.AddMinutes(options.LifetimeMinutes);

        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = options.Issuer,
            Audience = options.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = expiresAt,
            Subject = new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.UserName),
                new Claim(JwtRegisteredClaimNames.Name, user.DisplayName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            ]),
            SigningCredentials = new SigningCredentials(options.GetSigningKey(), SecurityAlgorithms.HmacSha256)
        });

        return new LoginResponse(token, expiresAt, user.UserName, user.DisplayName);
    }
}

public static class ClaimsPrincipalExtensions
{
    /// <summary>User name of the authenticated user, taken from the token's "sub" claim.</summary>
    public static string GetUserName(this ClaimsPrincipal user) =>
        user.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? throw new InvalidOperationException("The authenticated user has no 'sub' claim.");
}
