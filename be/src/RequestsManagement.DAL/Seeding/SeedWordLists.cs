namespace RequestsManagement.DAL.Seeding;

/// <summary>
/// Building blocks for realistic demo data. Changing these lists changes the generated data,
/// so measurements recorded before and after such a change are no longer comparable.
/// <para>
/// Seeder versions: v1 = English titles and organizations; v2 = Hebrew titles and a mix of Hebrew and English
/// organization names (D-33). v2 keeps the SIZE of every list, so the random draws, and with them the statuses,
/// priorities, dates, handlers, history and the choice of organization of every request, are the same as in v1;
/// only the words changed.
/// </para>
/// </summary>
internal static class SeedWordLists
{
    // User names are Latin text on purpose (login names): 40 first names × 40 last names → 40 unique demo users
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

    // An organization name is prefix + sector + suffix, e.g. "Cedar Logistics Ltd" or "גליל לוגיסטיקה בע״מ".
    // The language of the whole name follows its prefix (a Hebrew prefix takes the Hebrew sector and suffix),
    // so about half of the organizations are Hebrew and half English, and a name never mixes the two.
    public static readonly string[] OrganizationPrefixes =
    [
        "Cedar", "גליל", "Negev", "כרמל", "Arava", "אוריון", "Delta", "פסגה", "Atlas", "נובה",
        "Horizon", "חלוץ", "Meridian", "קודקוד", "Harbor", "זהב", "Blue Sky", "קו כסף", "Redwood", "אבן יסוד",
        "Hermon", "ירדן", "Kinneret", "תבור", "Sharon", "שפלה", "Eilat", "רמון", "Gilboa", "Modi'in",
        "Apex", "משואה", "Crest", "ירוק עד", "Frontier", "גרניט", "Lighthouse", "כוכב הצפון", "Oakridge", "מובילים"
    ];

    // The English and Hebrew sectors are in the same order, so index i is the same sector in both languages
    public static readonly string[] OrganizationSectors =
    [
        "Logistics", "Software", "Construction", "Foods", "Medical Center", "Engineering", "Retail", "Insurance",
        "Textiles", "Energy", "Security", "Consulting", "Transport", "Pharma", "Hotels", "Electronics",
        "Plastics", "Agritech", "Education", "Manufacturing"
    ];

    public static readonly string[] OrganizationSectorsHebrew =
    [
        "לוגיסטיקה", "תוכנה", "בנייה", "מזון", "מרכז רפואי", "הנדסה", "קמעונאות", "ביטוח",
        "טקסטיל", "אנרגיה", "אבטחה", "ייעוץ", "תחבורה", "פארמה", "מלונות", "אלקטרוניקה",
        "פלסטיקה", "חקלאות", "חינוך", "ייצור"
    ];

    public static readonly string[] OrganizationSuffixes = ["Ltd", "Inc", "Group", "Industries", "Holdings", "& Co"];

    public static readonly string[] OrganizationSuffixesHebrew = ["בע״מ", "(1990) בע״מ", "קבוצה", "תעשיות", "החזקות", "ושות׳"];

    // Title = template(subject) + context, e.g. "טעות בתלוש שכר למרץ".
    // The templates take a noun without an article and put a prefix letter (ב, ל) in front of it where needed,
    // and none of them depends on the gender of the subject, so every template fits every subject.
    public static readonly string[] TitleTemplates =
    [
        "שאלה לגבי {0}", "טעות ב{0}", "בקשה לעדכון {0}", "אי קבלת {0}", "חסר ב{0}",
        "אי אפשר להגיש {0}", "נדרש אישור עבור {0}", "תיקון ב{0}", "עיכוב ב{0}", "ביטול {0}",
        "סכום שגוי ב{0}", "הבהרה בנושא {0}", "כפילות ב{0}", "בעיית גישה ל{0}", "חידוש {0}",
        "תלונה בנושא {0}", "מעקב אחר {0}", "בקשה חדשה: {0}", "בעיה דחופה ב{0}", "שינוי ב{0}"
    ];

    public static readonly string[] TitleSubjects =
    [
        "תלוש שכר", "הפקדת פנסיה", "טופס קליטת עובד", "אישור מחלה", "טופס 106",
        "היתר עבודה", "יתרת חופשה", "חישוב שעות נוספות", "החזר נסיעות", "ביטוח בריאות",
        "תקציב הדרכה", "חוזה העסקה", "תשלום פיצויים", "פרטי בנק", "בונוס שנתי",
        "סידור משמרות", "כרטיס גישה", "היתר חניה", "בקשת מחשב נייד", "גישת VPN",
        "פורטל הטבות", "חופשת לידה", "פיצוי מילואים", "בקשת גיוס", "דוח נוכחות",
        "החזר הוצאות", "החזרת ציוד", "מכתב פיטורין", "קרן השתלמות", "שוברי אוכל"
    ];

    public static readonly string[] TitleContexts =
    [
        "", "", "", "", "", " למרץ", " לאפריל", " לרבעון 3", " לרבעון 4", " - דחוף",
        " (עובד חדש)", " לסניף חיפה", " למשרד תל אביב", " ל-12 עובדים", " לקבלנים",
        " אחרי שדרוג המערכת", " - פנייה שנייה", " לעובדים בחלקיות משרה", " למשמרת לילה", " לשנת 2025",
        " לסניף ירושלים", " - המשך טיפול", " למנהלים", " לצוות הלוגיסטיקה", " למתמחים"
    ];
}
