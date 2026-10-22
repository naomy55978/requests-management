using System.ComponentModel.DataAnnotations;

namespace RequestsManagement.DTO;

/// <summary>Login with a demo user name and password.</summary>
public class LoginRequest
{
    /// <summary>User name, e.g. <c>dana.cohen</c>.</summary>
    [Required, StringLength(50)]
    public string UserName { get; init; } = "";

    /// <summary>Password (all demo users share the demo password from the README).</summary>
    [Required, StringLength(100)]
    public string Password { get; init; } = "";
}

/// <summary>A signed access token. Send it as <c>Authorization: Bearer {accessToken}</c>.</summary>
public record LoginResponse(string AccessToken, DateTime ExpiresAt, string UserName, string DisplayName);
