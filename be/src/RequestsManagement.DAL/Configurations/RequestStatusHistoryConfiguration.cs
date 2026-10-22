using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RequestsManagement.DAL.Entities;

namespace RequestsManagement.DAL.Configurations;

internal class RequestStatusHistoryConfiguration : IEntityTypeConfiguration<RequestStatusHistory>
{
    public void Configure(EntityTypeBuilder<RequestStatusHistory> builder)
    {
        builder.ToTable("RequestStatusHistory", t =>
        {
            t.HasCheckConstraint("CK_RequestStatusHistory_PreviousStatus", "[PreviousStatus] BETWEEN 1 AND 4");
            t.HasCheckConstraint("CK_RequestStatusHistory_NewStatus", "[NewStatus] BETWEEN 1 AND 4");
        });

        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).UseIdentityColumn();

        builder.Property(h => h.PreviousStatus).HasColumnType("tinyint");
        builder.Property(h => h.NewStatus).HasColumnType("tinyint");
        builder.Property(h => h.ChangedAt).HasColumnType("datetime2");
        builder.Property(h => h.ChangedBy).HasMaxLength(100).IsRequired();

        // Requests are never deleted, so no cascade: history must not disappear silently
        builder.HasOne(h => h.Request)
            .WithMany(r => r.StatusHistory)
            .HasForeignKey(h => h.RequestId)
            .OnDelete(DeleteBehavior.NoAction);

        // GET /api/requests/{id}/history: all changes of one request in chronological order
        // (seek on RequestId, rows already sorted by ChangedAt). Also serves as the index for the FK.
        builder.HasIndex(h => new { h.RequestId, h.ChangedAt })
            .HasDatabaseName("IX_RequestStatusHistory_RequestId_ChangedAt");
    }
}
