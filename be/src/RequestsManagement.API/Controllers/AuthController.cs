using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RequestsManagement.API.Auth;
using RequestsManagement.BL;
using RequestsManagement.DTO;

namespace RequestsManagement.API.Controllers;

/// <summary>Login for the demo users.</summary>
[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService, JwtTokenService tokenService) : ControllerBase
{
    /// <summary>Log in and receive an access token.</summary>
    /// <remarks>
    /// The only endpoint that does not require a token. All demo users share the password <c>Demo123!</c>
    /// (user names such as <c>dana.cohen</c> appear in the AssignedTo field of the requests).
    /// Copy <c>accessToken</c> into the Authorize dialog of Swagger UI.
    /// </remarks>
    /// <response code="200">The access token and its expiry time.</response>
    /// <response code="400">User name or password is missing or too long.</response>
    /// <response code="401">Wrong user name or password (the response does not say which).</response>
    [AllowAnonymous]
    [HttpPost("login")]
    [ProducesResponseType<LoginResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await authService.ValidateCredentialsAsync(request.UserName, request.Password, cancellationToken);
        if (user is null)
        {
            return Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Invalid user name or password.");
        }

        return tokenService.CreateToken(user);
    }
}
