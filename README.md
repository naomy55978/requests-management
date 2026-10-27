# מערכת לניהול פניות

מערכת לניהול פניות ובקשות המתקבלות מארגונים ומעסיקים, לעבודה של כמה משתמשים במקביל מול 100,000 פניות. המשתמשים מאתרים פניות בחיפוש, בסינון, במיון ובדפדוף – כולם בצד השרת – ומעדכנים סטטוס, אחד־אחד או עד 100 בבת אחת. עדכון מתחרה נחסם ב־Optimistic Concurrency, כל שינוי נשמר בהיסטוריה, ולוח בקרה מציג נתונים מסכמים מתוך Cache.

> **סקירה מלאה במסמך אחד, עם תרשימים: [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)**

## שלושה Repos

- **[requests-management-docs](https://github.com/naomy55978/requests-management-docs)** (כאן) – תכנון ותיעוד: ה־Issues, ה־Milestones, ה־[Project Board](https://github.com/users/naomy55978/projects/2) וכל המסמכים.
- **[requests-management-be](https://github.com/naomy55978/requests-management-be)** – Backend: ‏REST API ב־‎.NET 10 מול SQL Server, בדיקות ו־CI.
- **[requests-management-fe](https://github.com/naomy55978/requests-management-fe)** – Frontend: אפליקציית Angular 22, בדיקות ו־CI.

## דרישות מקדימות

- **‎.NET SDK ‏10.0.401** ומעלה (נקבע ב־`global.json`).
- **Node.js 24** (או `^22.22.3`). ‏Node 20 לא נתמך ע״י Angular 22.
- **SQL Server LocalDB** ‏(`(localdb)\MSSQLLocalDB`, ברירת המחדל) או SQL Server 2022 ומעלה. מופע אחר, או SQL Server בקונטיינר (למשל ב־Mac/Linux) – ב־[README של ה־Backend](https://github.com/naomy55978/requests-management-be#מסד-הנתונים).

## הרצה

```
git clone https://github.com/naomy55978/requests-management-be.git
cd requests-management-be
dotnet run --project src/RequestsManagement.API --launch-profile http
```

בהרצה הראשונה ה־API יוצר את המסד `RequestsManagement`, מריץ את ה־Migrations ויוצר **100,000 פניות דמו** – אותם נתונים בכל פעם. זה לוקח כחצי דקה (יותר בהפעלה הראשונה של LocalDB), וה־API מתחיל להאזין ב־http://localhost:5084 רק בסוף; Swagger UI ב־http://localhost:5084/swagger. ליצירה מחדש של הנתונים: `dotnet run --project src/RequestsManagement.API -- seed --reset`.

```
git clone https://github.com/naomy55978/requests-management-fe.git
cd requests-management-fe
npm ci
npm start
```

האפליקציה ב־http://localhost:4200 (שרת הפיתוח מעביר את `/api` ל־API). התחברות: `dana.cohen` / `Demo123!`; משתמש שני עם אותה סיסמה: `amit.navon`. אלה נתוני דמו בלבד, ומפתח ה־JWT ב־`appsettings.Development.json` מיועד לפיתוח בלבד.

## מה לנסות בממשק

אחרי ההתחברות נפתח לוח הבקרה עם הספירות לפי סטטוס ועדיפות והארגונים עם הכי הרבה פניות פתוחות. במסך "פניות" אפשר להקליד בחיפוש ולראות שנשלחת בקשה אחת אחרי שההקלדה נעצרת, לשלב מסננים, למיין לפי עמודה ולדפדף – כל אלה נעשים בשרת. מתפריט השורה משנים סטטוס ופותחים את היסטוריית השינויים, ובסימון כמה שורות מעדכנים אותן יחד ורואים תוצאה לכל פנייה. כדי לראות התנגשות, פותחים את אותה פנייה בשתי לשוניות (`dana.cohen` ו־`amit.navon`), משנים אותה באחת ומנסים לשנות בשנייה: מתקבלת הודעה שהפנייה עודכנה בינתיים, והשורה מתרעננת לנתונים העדכניים.

## בדיקות

- **Backend:** ‏`dotnet test` – ‏**163 בדיקות**: ‏72 יחידה ו־91 Integration, דרך HTTP מול SQL Server אמיתי במסד זמני שנוצר ונמחק בכל ריצה.
- **Frontend:** ‏`npm test -- --watch=false` – ‏**300 בדיקות** (Vitest); וגם `npm run lint` ו־`npm run build`.
- **CI:** ‏GitHub Actions בכל Push בשני ה־Repos של הקוד; ה־Backend מול SQL Server 2022 בקונטיינר.

אלה המספרים העדכניים; מסמכים אחרים מפנים לכאן. **הוכחת ה־Concurrency** בפקודה אחת, מתיקיית ה־Backend:

```
dotnet test --filter "FullyQualifiedName~ConcurrencyTests"
```

התוצאה הצפויה: `Passed! - Failed: 0, Passed: 2`. הבדיקה הראשונה שולחת 20 עדכונים בו־זמנית עם אותה גרסה לכל אחת מ־10 פניות, ומוודאת שבכל פנייה בדיוק אחד מצליח, 19 מקבלים `409`, ונכתבת שורת היסטוריה אחת; השנייה מריצה Bulk במקביל לעדכונים בודדים ומוודאת מנצח אחד לכל פנייה, בלי שגיאות שרת.

המיפוי של כל בדיקה לדרישה (סינון, דפדוף, Validation, ‏Conflict, ‏Audit, ‏Bulk, ‏Invalidation של ה־Cache ו־Integration): [WORK_PLAN.md – מיפוי בדיקות לדרישות](docs/WORK_PLAN.md#מיפוי-בדיקות-לדרישות).

## תיעוד הפתרון

- **הוראות הרצה** – למעלה; כל האפשרויות (מופע אחר, כיבוי האתחול האוטומטי, הבדיקות) ב־[README של ה־Backend](https://github.com/naomy55978/requests-management-be#readme) וב־[README של ה־Frontend](https://github.com/naomy55978/requests-management-fe#readme).
- **טכנולוגיות וגרסאות** – ‏‎.NET 10 עם ASP.NET Core ו־EF Core 10, ‏SQL Server (LocalDB / 2022 ומעלה), ‏Angular 22.2 עם Angular Material 22, ‏RxJS 7.8 ו־TypeScript 6.0, ‏xUnit ו־Vitest; הגרסאות הנדרשות להרצה – [דרישות מקדימות](#דרישות-מקדימות).
- **מבנה הפתרון** – ארבע שכבות בשרת (API, ‏BL, ‏DAL, ‏DTO) ו־`core`/`features`/`shared` בלקוח: [PROJECT_SUMMARY – מבנה התיקיות](PROJECT_SUMMARY.md#מבנה-התיקיות).
- **בסיס הנתונים והאינדקסים** – ‏SQL Server בגלל `rowversion` המובנה, ושבעה אינדקסים שכל אחד נבחר במדידת logical reads ו־Execution Plan על 100,000 פניות: [PERFORMANCE.md](docs/PERFORMANCE.md).
- **Concurrency ו־Bulk** – ‏`UPDATE` מותנה על `RowVersion` שה־DB אוכף, ו־Bulk של עד 100 פניות עם Partial Success ותוצאה לכל פריט: [API.md](docs/API.md).
- **Cache ו־Invalidation** – הסיכום ב־`IMemoryCache` ל־60 שניות, מתבטל אחרי כל שינוי סטטוס שנשמר, ומה נדרש בכמה מופעי שרת: [CACHE.md](docs/CACHE.md).
- **שתי החלטות טכנולוגיות וחלופות** – Concurrency באכיפת ה־DB, ו־Bulk עם Partial Success: [DECISIONS.md – שתי החלטות מרכזיות](docs/DECISIONS.md#שתי-החלטות-מרכזיות); כל 48 ההחלטות באותו מסמך.
- **מגבלה ידועה ושיפור** – חיפוש `LIKE '%x%'` סורק את כל הטבלה, והשיפור הוא אינדקס n‑grams או Full‑Text: [DECISIONS.md – המגבלה והשיפור](docs/DECISIONS.md#המגבלה-והשיפור-שנבחרו-11-במבדק).
- **שימוש בכלי AI** – [למטה](#שימוש-בכלי-ai), והפירוט ב־[AI_USAGE.md](docs/AI_USAGE.md).

## תכנון העבודה

התוכנית ב־[WORK_PLAN.md](docs/WORK_PLAN.md): עשרה Milestones (M0–M9) עם סדר ביצוע ותלויות, הערכת מאמץ לכל משימה, ומטריצת דרישה ← משימות, כולל משימות שאינן קוד. כל משימה היא [Issue](https://github.com/naomy55978/requests-management-docs/issues?q=is%3Aissue) עם תיאור, תוצר מצופה, קריטריוני קבלה, מאמץ ותלויות, ומוצגת ב־[Project Board](https://github.com/users/naomy55978/projects/2) וב־[Milestones](https://github.com/naomy55978/requests-management-docs/milestones).

## שימוש בכלי AI

הקוד, הבדיקות והתיעוד נכתבו בעזרת Claude Code: ‏Opus לתכנון, ארכיטקטורה וסקירה, ו־Sonnet לכתיבת קוד ובדיקות. כל משימה עברה תוכנית ואישור מפורש של המפתחת לפני ביצוע, וההחלטות המרכזיות התקבלו על ידה. מה שה־AI כתב נבדק בבדיקות עם תוצאה צפויה שמחושבת מהנתונים, בבדיקות מוטציה ובדפדפן אמיתי. הפירוט: [AI_USAGE.md](docs/AI_USAGE.md).

## כל המסמכים

| נושא | מסמך |
|---|---|
| סקירת הפרויקט, עם תרשימים | [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) |
| החלטות, חלופות ומגבלות ידועות | [docs/DECISIONS.md](docs/DECISIONS.md) |
| התנהגות ה־API: Concurrency, ‏Bulk, ‏Summary | [docs/API.md](docs/API.md) |
| ביצועים: מדידות, אינדקסים, Plans ו־Bottleneck | [docs/PERFORMANCE.md](docs/PERFORMANCE.md) |
| Cache, ‏Invalidation וכמה מופעי שרת | [docs/CACHE.md](docs/CACHE.md) |
| תוכנית העבודה ומיפוי בדיקות לדרישות | [docs/WORK_PLAN.md](docs/WORK_PLAN.md) |
| שימוש בכלי AI | [docs/AI_USAGE.md](docs/AI_USAGE.md) |
| בדיקה מקצה לקצה מ־clone נקי (26–27.10.2026) | [docs/SUBMISSION_CHECK.md](docs/SUBMISSION_CHECK.md) |
