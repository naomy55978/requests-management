using Microsoft.EntityFrameworkCore;
using RequestsManagement.DAL.Entities;

namespace RequestsManagement.DAL;

internal class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Request> Requests => Set<Request>();
    public DbSet<RequestStatusHistory> RequestStatusHistory => Set<RequestStatusHistory>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Picks up every IEntityTypeConfiguration in this assembly (Configurations folder)
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // SQL Server's built-in UPPER, callable in LINQ also on a parameter (see Upper)
        modelBuilder.HasDbFunction(typeof(AppDbContext).GetMethod(nameof(Upper))!).HasName("UPPER").IsBuiltIn();
    }

    /// <summary>
    /// SQL Server's UPPER, for LINQ queries only. EF would evaluate <c>text.ToUpper()</c> of a local variable in .NET
    /// before sending it; a mapped database function always runs in SQL, so a column and a parameter are upper-cased
    /// by the same rules (the database's), and .NET and SQL Server case mappings cannot diverge.
    /// </summary>
    public static string Upper(string text) => throw new NotSupportedException("Only for use in LINQ queries.");
}
