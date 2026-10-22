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
    }
}
