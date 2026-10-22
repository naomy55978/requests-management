using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RequestsManagement.DAL.Entities;

namespace RequestsManagement.DAL.Configurations;

internal class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");

        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id).UseIdentityColumn();

        builder.Property(u => u.UserName).HasMaxLength(50).IsRequired();
        builder.Property(u => u.DisplayName).HasMaxLength(100).IsRequired();
    }
}
