# מערכת לניהול פניות – תכנון ותיעוד

מערכת לניהול פניות ובקשות המתקבלות מארגונים ומעסיקים. המערכת מיועדת לעבודה של מספר משתמשים במקביל מול כמות גדולה של פניות (100,000 ומעלה): איתור, סינון, מיון ודפדוף בצד השרת, עדכון סטטוס עם Optimistic Concurrency והיסטוריית שינויים, עדכון מרובה (Bulk) ונתונים מסכמים עם Cache.

**טכנולוגיות:** ‏‎.NET 10, ‏Angular 22 + Angular Material, ‏SQL Server.

> זהו ה־Repo של **התכנון והתיעוד** ונקודת הכניסה לבודקים. הקוד נמצא בשני Repos נפרדים (ראו D‑16).

## מבנה הפתרון

| Repo | תוכן |
|---|---|
| [requests-management-docs](https://github.com/naomy55978/requests-management-docs) (כאן) | תוכנית עבודה, החלטות, תיעוד, Issues ו־Milestones |
| [requests-management-be](https://github.com/naomy55978/requests-management-be) | Backend: ‏API, ‏BL, ‏DAL, ‏DTO, בדיקות, CI |
| [requests-management-fe](https://github.com/naomy55978/requests-management-fe) | Frontend: אפליקציית Angular |

## תכנון העבודה

- [Project Board](https://github.com/users/naomy55978/projects/2) – כל המשימות, הסטטוס והערכת המאמץ
- [Milestones](https://github.com/naomy55978/requests-management-docs/milestones) – M0 עד M9
- [Issues](https://github.com/naomy55978/requests-management-docs/issues) – משימה לכל יחידת עבודה, עם תוצר, תלויות, מאמץ וסעיף המבדק שהיא מכסה
- [docs/WORK_PLAN.md](docs/WORK_PLAN.md) – תוכנית העבודה, סדר ביצוע ומטריצת מעקב דרישה ← משימות

## תיעוד

- [docs/DECISIONS.md](docs/DECISIONS.md) – החלטות טכנולוגיות, נימוקים וחלופות שנשקלו
- [PROJECT_TRACKING_RequestsManagement.md](PROJECT_TRACKING_RequestsManagement.md) – קובץ המעקב של הפרויקט: אפיון, מצב העבודה וצעדים הבאים

תיעוד ה־API, הביצועים, הוראות ההרצה המלאות והשימוש בכלי AI יתווספו במהלך העבודה (M4–M9).
