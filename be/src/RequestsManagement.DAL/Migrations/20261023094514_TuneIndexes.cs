using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RequestsManagement.DAL.Migrations
{
    /// <inheritdoc />
    public partial class TuneIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Requests_AssignedTo_Status",
                table: "Requests");

            migrationBuilder.DropIndex(
                name: "IX_Requests_OrganizationName",
                table: "Requests");

            migrationBuilder.DropIndex(
                name: "IX_Requests_Status_Priority_CreatedAt",
                table: "Requests");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_AssignedTo_CreatedAt",
                table: "Requests",
                columns: new[] { "AssignedTo", "CreatedAt" })
                .Annotation("SqlServer:Include", new[] { "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Requests_OrganizationName_CreatedAt",
                table: "Requests",
                columns: new[] { "OrganizationName", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Requests_Priority",
                table: "Requests",
                column: "Priority");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_Status_Priority_CreatedAt",
                table: "Requests",
                columns: new[] { "Status", "Priority", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Requests_Title",
                table: "Requests",
                column: "Title");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_UpdatedAt",
                table: "Requests",
                column: "UpdatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Requests_AssignedTo_CreatedAt",
                table: "Requests");

            migrationBuilder.DropIndex(
                name: "IX_Requests_OrganizationName_CreatedAt",
                table: "Requests");

            migrationBuilder.DropIndex(
                name: "IX_Requests_Priority",
                table: "Requests");

            migrationBuilder.DropIndex(
                name: "IX_Requests_Status_Priority_CreatedAt",
                table: "Requests");

            migrationBuilder.DropIndex(
                name: "IX_Requests_Title",
                table: "Requests");

            migrationBuilder.DropIndex(
                name: "IX_Requests_UpdatedAt",
                table: "Requests");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_AssignedTo_Status",
                table: "Requests",
                columns: new[] { "AssignedTo", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Requests_OrganizationName",
                table: "Requests",
                column: "OrganizationName");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_Status_Priority_CreatedAt",
                table: "Requests",
                columns: new[] { "Status", "Priority", "CreatedAt" },
                descending: new[] { false, false, true })
                .Annotation("SqlServer:Include", new[] { "Title", "OrganizationName", "AssignedTo", "UpdatedAt", "RowVersion" });
        }
    }
}
