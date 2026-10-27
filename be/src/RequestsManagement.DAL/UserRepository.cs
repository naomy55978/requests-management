using Microsoft.EntityFrameworkCore;

namespace RequestsManagement.DAL;

internal sealed class UserRepository(AppDbContext db) : IUserRepository
{
    // Seek on the unique index UX_Users_UserName (case-insensitive, like the database collation)
    public Task<UserCredentials?> FindCredentialsAsync(string userName, CancellationToken cancellationToken) =>
        db.Users.AsNoTracking()
            .Where(u => u.UserName == userName)
            .Select(u => new UserCredentials(u.UserName, u.DisplayName, u.PasswordHash))
            .SingleOrDefaultAsync(cancellationToken);
}
