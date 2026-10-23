# מערכת לניהול פניות – Backend

צד השרת של מערכת ניהול הפניות: REST API ב־‎.NET 10 מול SQL Server.

> התכנון, ההחלטות וה־Issues נמצאים ב־[requests-management-docs](https://github.com/naomy55978/requests-management-docs) – נקודת הכניסה לפרויקט. ה־Frontend נמצא ב־[requests-management-fe](https://github.com/naomy55978/requests-management-fe).

## מבנה

```
RequestsManagement.sln
src/
  RequestsManagement.API   Controllers, טיפול בשגיאות, אימות (JWT), Program.cs
  RequestsManagement.BL    לוגיקה עסקית, חוקי מעברי סטטוס, Validation, Cache
  RequestsManagement.DAL   Entities, ‏DbContext, ‏Repository, ‏Migrations, ‏Seeder
  RequestsManagement.DTO   מודלים לבקשות ולתשובות (ללא תלויות)
tests/
  RequestsManagement.Tests בדיקות יחידה (Unit/) ו־Integration (Integration/)
```

## בנייה

דרישות מקדימות: ‏‎.NET SDK 10.0.401 ומעלה (הגרסה נקבעת ב־`global.json`).

```
dotnet build RequestsManagement.sln
```

## מסד הנתונים

בהרצה ב־Development ה־API יוצר את מסד הנתונים `RequestsManagement` לבד: מריץ את ה־Migrations, ואם המסד ריק – יוצר 100,000 פניות דמו (נתונים זהים בכל הרצה). אין צורך בצעד ידני (החלטה D‑17).

- **ההרצה הראשונה עשויה להימשך מספר דקות** (הקמת המסד + יצירת 100,000 פניות, ב־LocalDB "קר" נמדדו אף 2–3 דקות). בזמן זה ה־API עדיין לא מאזין, וב־Console מופיעה ההודעה `Seeding 100,000 requests - this may take a few minutes on first run`. הרצות הבאות מדלגות על היצירה ועולות תוך שניות.
- ברירת המחדל: ‏SQL Server LocalDB – ‏`(localdb)\MSSQLLocalDB`.
- מופע אחר: לדרוס את `ConnectionStrings:RequestsDb` באמצעות user-secrets או משתנה הסביבה `ConnectionStrings__RequestsDb`.
- כיבוי האתחול האוטומטי: ‏`Database:MigrateOnStartup` / ‏`Database:SeedOnStartup` (מופעלים ב־`appsettings.Development.json`).
- יצירה מחדש של הנתונים:

```
dotnet run --project src/RequestsManagement.API -- seed --count 100000 --reset
```

‏`--reset` מוחק את המסד ויוצר אותו מחדש, ומותר רק כאשר שם המסד הוא בדיוק `RequestsManagement`.

## ה־API

```
dotnet run --project src/RequestsManagement.API --launch-profile http
```

ב־Development זמין **Swagger UI** בכתובת http://localhost:5084/swagger – תיעוד כל הפרמטרים (כולל `assignedTo=unassigned` לפניות ללא מטפל) ואפשרות לנסות את ה־API.

### התחברות

**כל ה־Endpoints דורשים טוקן**, מלבד ההתחברות עצמה (החלטה D‑10).

1. ב־Swagger UI: ‏`POST /api/auth/login` עם משתמש דמו, למשל `{"userName": "dana.cohen", "password": "Demo123!"}`.
   לכל משתמשי הדמו אותה סיסמה – **`Demo123!`** (נתוני דמו בלבד). שמות משתמשים נוספים מופיעים בשדה `assignedTo` של הפניות.
2. להעתיק את `accessToken` מהתשובה, ללחוץ **Authorize** ולהדביק אותו.

הטוקן תקף 8 שעות; לאחר מכן כל קריאה מחזירה `401`. מפתח החתימה ב־`appsettings.Development.json` מיועד לפיתוח בלבד – בכל סביבה אחרת יש לספק `Jwt__SigningKey` (לפחות 32 בתים), אחרת ה־API לא יעלה.

### Endpoints

- `GET /api/requests` – רשימה עם דפדוף, סינון משולב, חיפוש ומיון בצד השרת
- `GET /api/requests/{id}` – פנייה בודדת (כולל `version`)
- `GET /api/requests/summary` – ספירות לפי סטטוס ועדיפות וארגונים מובילים בפניות פתוחות
- `PATCH /api/requests/{id}/status` – שינוי סטטוס עם `{"newStatus": "...", "version": "..."}` (Optimistic Concurrency): ‏`409` אם מישהו שינה את הפנייה בינתיים, ‏`422` למעבר סטטוס אסור
- `GET /api/requests/{id}/history` – היסטוריית שינויי הסטטוס (מי ומתי)

כל השגיאות חוזרות בפורמט `ProblemDetails` אחד (כולל `traceId`); קלט לא תקין – `400` עם רשימת כל הבעיות.

## בדיקות אוטומטיות

```
dotnet test
```

הבדיקות נמצאות ב־`tests/RequestsManagement.Tests`:

| תיקייה | מה בודקים | מול מה רצות |
|---|---|---|
| `Unit/` | מטריצת מעברי הסטטוס (כל 16 הצירופים), כללי הקלט של הבקשות (גבולות דפדוף, 100 פריטים ב־Bulk, מזהים כפולים), ה־Cache של ה־summary (כולל מונה ה־"דור" ופקיעה של 60 שנ' בשעון מבוקר, בלי המתנה) ומתי השירות מנקה אותו | בזיכרון, בלי מסד נתונים |
| `Integration/` | ה־API האמיתי (`WebApplicationFactory`) מול SQL Server אמיתי: אימות (401), סינון, חיפוש, מיון ודפדוף בצד השרת, ‏PATCH (‏200/409/422/404/400), ‏`ChangedBy` מהטוקן, היסטוריה, ‏Bulk עם Partial Success, ‏ה־summary וה־Invalidation שלו | מסד זמני |
| `Integration/ConcurrencyTests.cs` | אין Lost Update: 20 בקשות PATCH במקביל עם אותה גרסה ← בדיוק `200` אחד ושורת היסטוריה אחת; ‏Bulk במקביל לבקשות PATCH בודדות ← מנצח אחד לכל פנייה, ובלי שגיאות שרת | מסד זמני |

### חיבור ל־SQL Server

בדיקות ה־Integration צריכות SQL Server. החיבור נקבע במשתנה הסביבה `TESTS_SQL_CONNECTION` – מחרוזת חיבור **לשרת, בלי שם מסד נתונים**:

```powershell
# מופע ברירת מחדל מקומי עם Windows Authentication
$env:TESTS_SQL_CONNECTION = "Server=.;Trusted_Connection=True;TrustServerCertificate=True"
dotnet test
```

אם המשתנה לא מוגדר, הבדיקות מנסות לפי הסדר `Server=.` ואז LocalDB (`(localdb)\MSSQLLocalDB`); אם אף אחד מהם לא זמין, הבדיקות נכשלות עם הודעה שמסבירה מה נוסה. (הרצה ראשונה על LocalDB "קר" עלולה לארוך זמן.)

**מחשב עם מעט זיכרון פנוי:** כש־SQL Server נאלץ לדחוס את הזיכרון שלו (ביומן השגיאות שלו מופיעה ההודעה "a significant part of SQL Server process memory has been paged out"), שאילתה בודדת עלולה להיתקע עשרות שניות, וה־API יחזיר `500` אחרי Timeout של 30 שניות; הבדיקה הנוגעת בה תיכשל ב־`InternalServerError` והריצה תארך דקות. זו בעיית סביבה ולא באג: הרצה חוזרת עוברת. כדאי לסגור אפליקציות כבדות לפני הרצה.

### מה הבדיקות יוצרות ומוחקות

- בתחילת הריצה נוצר מסד זמני בשם `RequestsManagement_Tests_<מזהה אקראי>`; ה־Schema נבנה מה־Migrations האמיתיים, ונכנסים אליו נתוני בדיקה קטנים וקבועים (40 פניות ו־3 משתמשים, לא 100,000). בסוף הריצה המסד נמחק.
- הבדיקות לא נוגעות במסד `RequestsManagement` של הפיתוח ולא בשום מסד אחר במופע, ורק מסד בשם הזה ניתן למחיקה ע״י הקוד.
- בדיקות שמשנות נתונים עובדות על פניות שהן יצרו בעצמן, ולכן אינן תלויות זו בזו או בסדר הריצה. הן רצות ברצף (ללא הרצה מקבילית בין בדיקות), כי ה־Cache וה־summary משותפים.
- אם הריצה נקטעה באמצע (קריסה, סגירת חלון) ייתכן שנשאר מסד זמני. מחיקה ידנית:

  ```sql
  SELECT name FROM sys.databases WHERE name LIKE 'RequestsManagement[_]Tests[_]%';
  -- DROP DATABASE [<השם שהתקבל>];
  ```

### הרצה חלקית

```
dotnet test --filter "FullyQualifiedName~Unit"           # רק בדיקות יחידה (בלי מסד נתונים)
dotnet test --filter "FullyQualifiedName~Concurrency"    # רק בדיקות המקביליות
```

### CI

ב־GitHub Actions (`.github/workflows/build.yml`) הבדיקות רצות מול SQL Server בקונטיינר (service container), אחרי המתנה לכך שהוא עונה. מחרוזת החיבור מוגדרת ב־`TESTS_SQL_CONNECTION`, והסיסמה היא סיסמת קונטיינר חד־פעמי שנמחק בסוף הריצה. בדיקה שנכשלת מכשילה את ה־build, ותוצאות הבדיקות נשמרות כ־Artifact (`test-results`).

### הבדיקות והסקריפטים

הסקריפטים ב־`scripts/` (ראו למטה) אינם מוחלפים: הם בודקים מול מסד של 100,000 פניות, מודדים זמני תגובה, ובודקים פקיעה אמיתית של ה־Cache אחרי 60 שניות. הבדיקות האוטומטיות מכסות את אותם תרחישי התנהגות בצורה מהירה (שניות) ויציבה, ורצות בכל Push.

## סקריפטי אימות

חמישה סקריפטים בתיקייה `scripts/` בודקים את ה־API מקצה לקצה מול מסד נתונים אמיתי. **ה־API חייב לרוץ** (ראו למעלה), והמסד חייב להיות זרוע (100,000 פניות ומשתמשי הדמו). כל סקריפט **מתחבר קודם כמשתמש דמו** ושולח את הטוקן בכל קריאה. כל אחד מסתיים ב־`ALL CHECKS PASSED` (קוד יציאה 0) או ברשימת הבדיקות שנכשלו.

| סקריפט | מה הוא בודק | משנה נתונים? |
|---|---|---|
| `dotnet run scripts/ConcurrencyProof.cs` | אין Lost Update: לכל אחת מ־50 פניות – 20 בקשות שינוי סטטוס **במקביל** עם אותה גרסה, משני משתמשים. מצופה: בדיוק `200` אחד ו־19 תשובות `409`, ושורת היסטוריה אחת בלבד – של המנצח | כן |
| `node scripts/verify-read-api.js` | שליפה (M2): סינון, חיפוש, מיון ודפדוף – בהשוואה לשאילתות SQL ישירות; Validation ופורמט השגיאות; ‏Summary; תיעוד OpenAPI; זמני תגובה | לא |
| `node scripts/verify-status-update.js` | עדכון סטטוס (M3): כל 16 צירופי המעברים, 404/409/422/400/401/415, היסטוריה, `ChangedBy` מהטוקן, עקביות כל הטבלה | כן |
| `node scripts/verify-bulk-status.js` | עדכון סטטוס מרוכז (M4, D‑08): ולידציה (ריק, מעל 100, מזהה כפול – `400` ושום שינוי), כל התוצאות בבקשה אחת (Updated / NotFound / Conflict / InvalidTransition) והשפעה על ה־DB וההיסטוריה, `ChangedBy` מהטוקן, 100 פריטים בבקשה אחת, ובקשות Bulk **במקביל** לבקשות PATCH בודדות על אותן פניות (מנצח אחד בלבד לכל פנייה, בלי 5xx). `RACE_REQUESTS` ו־`RACE_ROUNDS` קובעים את גודל בדיקת המקביליות | כן |
| `node scripts/verify-summary-cache.js` | Cache של ה־summary (M5, D‑11): פגיעה ב־Cache מהירה פי עשרות מפספוס, פגיעה לא פונה ל־DB (שינוי ישיר ב־SQL לא נראה), פקיעה אוטומטית אחרי 60 שנ' (**הסקריפט ממתין דקה**; `SKIP_EXPIRY=1` מדלג), ה־summary משקף שינוי מיד אחרי PATCH ואחרי Bulk, שינוי שנכשל לא מנקה, וקריאות במקביל לשינוי לא משאירות נתון ישן | כן |

דרישות לסקריפטי ה־Node: ‏Node.js 18 ומעלה ו־`sqlcmd` ב־PATH (הם משווים מול SQL ישיר). משתני סביבה אופציונליים:

- `API_URL` – ברירת מחדל `http://localhost:5084` (ל־`ConcurrencyProof.cs`: הארגומנט `--base-url`)
- `SQL_SERVER` – ברירת מחדל `(localdb)\MSSQLLocalDB`; אם ה־API מוגדר למופע אחר, לציין אותו, למשל `SQL_SERVER=.`

הסקריפטים שמשנים נתונים מתעדים את השינויים בהיסטוריה (תחת `dana.cohen` ו־`yossi.friedman`). כדי לחזור לנתונים המקוריים:

```
dotnet run --project src/RequestsManagement.API -- seed --reset
```

> במחשב עם מעט זיכרון פנוי, SQL Server עלול להאט מאוד או לא לענות (timeout של 30 שנ' ← `500`), ואז בדיקות בודדות נכשלות. מומלץ לסגור אפליקציות כבדות לפני ההרצה.

הוראות הרצה מלאות (כולל הבדיקות) יתווספו ב־M9.

> היסטוריית העבודה של M0 (הקמת ה־Solution) נשמרה ב־Repo של התיעוד, ממנו הקוד הועבר לכאן.
