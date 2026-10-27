# מערכת לניהול פניות – Backend

צד השרת של מערכת ניהול הפניות: REST API ב־‎.NET 10 מול SQL Server.

> התכנון, ההחלטות וה־Issues נמצאים ב־[requests-management-docs](https://github.com/naomy55978/requests-management-docs) – נקודת הכניסה לפרויקט. ה־Frontend נמצא ב־[requests-management-fe](https://github.com/naomy55978/requests-management-fe).

## דרישות מקדימות

| כלי | גרסה נדרשת | הערות |
|---|---|---|
| **‎.NET SDK** | **10.0.401** ומעלה | נקבע ב־`global.json` (‏`rollForward: latestFeature`). |
| **SQL Server** | **LocalDB** ‏(`(localdb)\MSSQLLocalDB`) – ברירת המחדל; או SQL Server 2022 ומעלה | נבדק מול LocalDB של SQL Server 2025 (פיתוח) ומול SQL Server 2022 בקונטיינר (CI). מופע אחר – ראו [מסד הנתונים](#מסד-הנתונים). |

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

דרישות: ראו [דרישות מקדימות](#דרישות-מקדימות).

```
dotnet build RequestsManagement.sln
```

## מסד הנתונים

בהרצה ב־Development ה־API יוצר את מסד הנתונים `RequestsManagement` לבד: מריץ את ה־Migrations, ואם המסד ריק – יוצר 100,000 פניות דמו (נתונים זהים בכל הרצה; כותרות בעברית, ושמות ארגונים בעברית ובאנגלית – D‑33). אין צורך בצעד ידני (החלטה D‑17).

- **ההרצה הראשונה לוקחת זמן** (הקמת המסד + יצירת 100,000 פניות). נמדד מ־clone נקי על LocalDB קר, פעמיים, עם 2.3–2.8 GB זיכרון פנוי: 30–40 שנ' מ־`dotnet run` ועד שה־API מאזין, מתוכן 14–25 שנ' ל־Seed; בהפעלה הראשונה אי־פעם של LocalDB, או במחשב עמוס, נמדדו גם יותר משתי דקות. בזמן זה ה־API עדיין לא מאזין, וב־Console מופיעה ההודעה `Seeding 100,000 requests - this may take a few minutes on first run`. הרצות הבאות מדלגות על היצירה ועולות תוך שניות.
- ברירת המחדל: ‏SQL Server LocalDB – ‏`(localdb)\MSSQLLocalDB`.
- מופע אחר: לדרוס את `ConnectionStrings:RequestsDb` באמצעות user-secrets או משתנה הסביבה `ConnectionStrings__RequestsDb`.
- **בלי LocalDB (למשל Mac/Linux):** SQL Server 2022 בקונטיינר – זה אותו Image שמולו רצות הבדיקות ב־CI. **הפקודה לא הורצה במחשב הפיתוח** (אין בו Docker – החלטות D‑09, D‑47):

```
docker run -d --name requests-sql -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=<סיסמה חזקה>" -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest
```

ואז, לפני `dotnet run`:

```
export ConnectionStrings__RequestsDb="Server=localhost,1433;Database=RequestsManagement;User Id=sa;Password=<אותה סיסמה>;TrustServerCertificate=True"
```

(ב־PowerShell: ‏`$env:ConnectionStrings__RequestsDb = "..."`). לבדיקות האוטומטיות – אותה מחרוזת בלי `Database=…` במשתנה `TESTS_SQL_CONNECTION` (ראו "חיבור ל־SQL Server" למטה).
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
   לכל משתמשי הדמו אותה סיסמה – **`Demo123!`** (נתוני דמו בלבד). משתמש שני, למשל לבדיקת `409` בשתי לשוניות: ‏`amit.navon`. שמות משתמשים נוספים מופיעים בשדה `assignedTo` של הפניות.
2. להעתיק את `accessToken` מהתשובה, ללחוץ **Authorize** ולהדביק אותו.

הטוקן תקף 8 שעות; לאחר מכן כל קריאה מחזירה `401`. מפתח החתימה ב־`appsettings.Development.json` מיועד לפיתוח בלבד – בכל סביבה אחרת יש לספק `Jwt__SigningKey` (לפחות 32 בתים), אחרת ה־API לא יעלה.

### Endpoints

- `GET /api/requests` – רשימה עם דפדוף, סינון משולב, חיפוש ומיון בצד השרת
- `GET /api/requests/{id}` – פנייה בודדת (כולל `version`)
- `GET /api/requests/summary` – ספירות לפי סטטוס ועדיפות וארגונים מובילים בפניות פתוחות
- `PATCH /api/requests/{id}/status` – שינוי סטטוס עם `{"newStatus": "...", "version": "..."}` (Optimistic Concurrency): ‏`409` אם מישהו שינה את הפנייה בינתיים, ‏`422` למעבר סטטוס אסור
- `GET /api/requests/{id}/history` – היסטוריית שינויי הסטטוס (מי ומתי)
- `POST /api/requests/bulk-status` – שינוי סטטוס של 1 עד 100 פניות בקריאה אחת, עם `{"newStatus": "...", "items": [{"id": ..., "version": "..."}]}`; כל פנייה בטרנזקציה משלה (Partial Success), והתשובה `200` עם תוצאה לכל פנייה

כל השגיאות חוזרות בפורמט `ProblemDetails` אחד (כולל `traceId`); קלט לא תקין – `400` עם רשימת כל הבעיות.

## בדיקות אוטומטיות

```
dotnet test
```

הבדיקות נמצאות ב־`tests/RequestsManagement.Tests`:

| תיקייה | מה בודקים | מול מה רצות |
|---|---|---|
| `Unit/` | מטריצת מעברי הסטטוס (כל 16 הצירופים), כללי הקלט של הבקשות (גבולות דפדוף, אורך מינימלי לחיפוש, 100 פריטים ב־Bulk, מזהים כפולים), ה־Cache של ה־summary (כולל מונה ה־"דור", טעינה חוזרת אחת ופקיעה של 60 שנ' בשעון מבוקר, בלי המתנה), מתי השירות מנקה אותו, ובחירת שרת הבדיקות | בזיכרון, בלי מסד נתונים |
| `Integration/` | ה־API האמיתי (`WebApplicationFactory`) מול SQL Server אמיתי: אימות (401), סינון, חיפוש, מיון ודפדוף בצד השרת, ‏PATCH (‏200/409/422/404/400), ‏`ChangedBy` מהטוקן, היסטוריה, אטומיות העדכון ושורת ה־Audit (במסד משלה), ‏Bulk עם Partial Success, ‏ה־summary וה־Invalidation שלו | מסד זמני |
| `Integration/ConcurrencyTests.cs` | אין Lost Update: 20 בקשות PATCH במקביל עם אותה גרסה ← בדיוק `200` אחד ושורת היסטוריה אחת; ‏Bulk במקביל לבקשות PATCH בודדות ← מנצח אחד לכל פנייה, ובלי שגיאות שרת | מסד זמני |

### חיבור ל־SQL Server

בדיקות ה־Integration צריכות SQL Server. **ברירת המחדל היא LocalDB** (`(localdb)\MSSQLLocalDB`), בלי צורך בהגדרה. כל שרת אחר – גם מופע ברירת מחדל מקומי – נבחר **רק** במשתנה הסביבה `TESTS_SQL_CONNECTION`: מחרוזת חיבור **לשרת, בלי שם מסד נתונים**, עם הרשאה ליצור מסד:

```powershell
# מופע ברירת מחדל מקומי עם Windows Authentication
$env:TESTS_SQL_CONNECTION = "Server=.;Trusted_Connection=True;TrustServerCertificate=True"
dotnet test
```

אם אי אפשר להתחבר לשרת שנבחר, הבדיקות נכשלות עם הודעה שאומרת לאיזה שרת ניסו ואיך לבחור אחר. (הרצה ראשונה על LocalDB "קר" עלולה לארוך זמן.)

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

## מדידת ביצועים

`scripts/MeasureQueries.cs` (M8) מריץ ישירות מול SQL Server את ה־SQL ש־EF מייצר לתרחישי ה־API העיקריים (רשימה עם סינון משולב, מיונים, דף עמוק, חיפוש, Summary, היסטוריה ועדכון סטטוס שמבוטל ב־Rollback). לכל שאילתה הוא שומר logical reads ‏(`STATISTICS IO`), את ה־Execution Plan בפועל (קובץ `.sqlplan` ועץ אופרטורים בטקסט: Sort, ‏Key Lookup, ‏Memory Grant, ‏DOP) וזמנים חמים. ה־API לא צריך לרוץ. התוצאות והניתוח: `docs/PERFORMANCE.md` ב־Repo התיעוד.

```
dotnet run scripts/MeasureQueries.cs -- --out <dir> --label final
dotnet run scripts/MeasureQueries.cs -- --out <dir> --compare before final
```

- `--shape original` מודד את ה־SQL שלפני M8; ‏`--alternatives` מודד את חלופות השאילתה שנבחנו; ‏`--disable <index>` מכבה אינדקס אחד לריצה ותמיד בונה אותו מחדש בסוף (רק במסד בשם `RequestsManagement`, ולא את ה־Clustered Index).
- `SQL_SERVER` – ברירת מחדל `(localdb)\MSSQLLocalDB`. הסקריפט לא משנה נתונים ולא מריץ פקודות ברמת המופע: ניקוי Plans רק למסד הזה (`ALTER DATABASE SCOPED CONFIGURATION CLEAR PROCEDURE_CACHE`).

> היסטוריית העבודה של M0 (הקמת ה־Solution) נשמרה ב־Repo של התיעוד, ממנו הקוד הועבר לכאן.
