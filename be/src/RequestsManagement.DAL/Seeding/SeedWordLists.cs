namespace RequestsManagement.DAL.Seeding;

/// <summary>
/// Building blocks for realistic demo data. Changing these lists changes the generated data,
/// so measurements recorded before and after such a change are no longer comparable.
/// </summary>
internal static class SeedWordLists
{
    // 40 first names × 40 last names → 40 unique demo users (request handlers)
    public static readonly string[] FirstNames =
    [
        "Dana", "Yossi", "Michal", "Avi", "Noa", "Eyal", "Shira", "Omer", "Tamar", "Itai",
        "Maya", "Ronen", "Yael", "Gil", "Hila", "Amit", "Liat", "Doron", "Keren", "Nir",
        "Efrat", "Tal", "Orly", "Boaz", "Sigal", "Uri", "Galit", "Ido", "Rina", "Asaf",
        "Inbal", "Lior", "Merav", "Ziv", "Adi", "Erez", "Sarit", "Yoav", "Neta", "Ran"
    ];

    public static readonly string[] LastNames =
    [
        "Cohen", "Levi", "Mizrahi", "Peretz", "Biton", "Dahan", "Avraham", "Friedman", "Azoulay", "Katz",
        "Malka", "Shapiro", "Hadad", "Ben-David", "Gabay", "Amar", "Klein", "Ohana", "Segal", "Golan",
        "Rosen", "Weiss", "Sasson", "Elbaz", "Barak", "Navon", "Harel", "Tal", "Carmi", "Shalev",
        "Yosef", "Ashkenazi", "Gold", "Vaknin", "Raz", "Eliyahu", "Stern", "Halevi", "Ezra", "Sharon"
    ];

    // Combined into several hundred unique organization names, e.g. "Cedar Logistics Ltd"
    public static readonly string[] OrganizationPrefixes =
    [
        "Cedar", "Galil", "Negev", "Carmel", "Arava", "Orion", "Delta", "Summit", "Atlas", "Nova",
        "Horizon", "Pioneer", "Meridian", "Vertex", "Harbor", "Golden", "Blue Sky", "Silverline", "Redwood", "Keystone",
        "Hermon", "Yarden", "Kinneret", "Tavor", "Sharon", "Shefela", "Eilat", "Ramon", "Gilboa", "Modi'in",
        "Apex", "Beacon", "Crest", "Evergreen", "Frontier", "Granite", "Lighthouse", "Northstar", "Oakridge", "Prime"
    ];

    public static readonly string[] OrganizationSectors =
    [
        "Logistics", "Software", "Construction", "Foods", "Medical Center", "Engineering", "Retail", "Insurance",
        "Textiles", "Energy", "Security", "Consulting", "Transport", "Pharma", "Hotels", "Electronics",
        "Plastics", "Agritech", "Education", "Manufacturing"
    ];

    public static readonly string[] OrganizationSuffixes = ["Ltd", "Inc", "Group", "Industries", "Holdings", "& Co"];

    // Title = template(subject) + context, e.g. "Error in salary slip for March"
    public static readonly string[] TitleTemplates =
    [
        "Question about {0}", "Error in {0}", "Request to update {0}", "{0} not received", "Missing {0}",
        "Cannot submit {0}", "Approval needed for {0}", "Correction to {0}", "Delay in {0}", "Cancel {0}",
        "Wrong amount in {0}", "Clarification on {0}", "Duplicate {0}", "Access problem with {0}", "Renewal of {0}",
        "Complaint about {0}", "Status of {0}", "New request: {0}", "Urgent issue with {0}", "Change in {0}"
    ];

    public static readonly string[] TitleSubjects =
    [
        "salary slip", "pension deposit", "employee onboarding form", "sick leave approval", "tax form 106",
        "work permit", "vacation balance", "overtime calculation", "travel expenses", "health insurance",
        "training budget", "employment contract", "severance payment", "bank details", "annual bonus",
        "shift schedule", "access card", "parking permit", "laptop request", "VPN access",
        "benefits portal", "maternity leave", "reserve duty compensation", "recruitment request", "attendance report",
        "expense reimbursement", "equipment return", "termination letter", "study fund", "meal vouchers"
    ];

    public static readonly string[] TitleContexts =
    [
        "", "", "", "", "", " for March", " for April", " for Q3", " for Q4", " - urgent",
        " (new employee)", " for the Haifa branch", " for the Tel Aviv office", " for 12 employees", " for contractors",
        " after system upgrade", " - second request", " for part-time staff", " for the night shift", " for 2025",
        " for the Jerusalem branch", " - follow up", " for managers", " for the logistics team", " for interns"
    ];
}
