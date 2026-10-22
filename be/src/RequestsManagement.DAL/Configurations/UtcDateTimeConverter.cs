using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace RequestsManagement.DAL.Configurations;

/// <summary>
/// All dates are stored as UTC in datetime2 (which has no time zone). SQL Server returns them with
/// Kind=Unspecified, which would be serialized without the "Z" suffix and read as local time by clients.
/// This converter marks every value read from the database as UTC. It does not change the column type.
/// </summary>
internal static class UtcDateTimeConverter
{
    public static readonly ValueConverter<DateTime, DateTime> Instance = new(
        toProvider => toProvider,
        fromProvider => DateTime.SpecifyKind(fromProvider, DateTimeKind.Utc));
}
