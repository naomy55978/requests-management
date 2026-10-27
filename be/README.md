# מערכת לניהול פניות – Backend

צד השרת של מערכת ניהול הפניות: REST API ב־‎.NET 10 מול SQL Server.

> התכנון, ההחלטות וה־Issues נמצאים ב־[requests-management-docs](https://github.com/naomy55978/requests-management-docs) – נקודת הכניסה לפרויקט. ה־Frontend נמצא ב־[requests-management-fe](https://github.com/naomy55978/requests-management-fe).

## דרישות מקדימות

| כלי | גרסה נדרשת | הערות |
|---|---|---|
| **‎.NET SDK** | **10.0.401** ומעלה | נקבע ב־`global.json` (‏`rollForward: latestFeature`). |
| **SQL Server** | **LocalDB** ‏(`(localdb)\MSSQLLocalDB`) – ברירת המחדל; או SQL Server 2022 ומעלה | נבדק מול LocalDB של SQL Server 2025 (פיתוח) ומול SQL Server 2022 בקונטיינר (CI). מופע אחר – ראו [מסד הנתונים](#מסד-הנתונים). |
| **Node.js** + **`sqlcmd`** | Node.js 18 ומעלה | **רק** לסקריפטי האימות ב־`scripts/` – לא נדרשים לבנייה, להרצה או לבדיקות. |

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
- **חימום בעלייה (D‑48):** אחרי ה־Seed ולפני שה־API מאזין הוא מבקש את הסיכום פעם אחת (ביומן: `Warming up…` ואחריו `Warm-up done in N ms`), כדי שהמסד וה־Cache יהיו חמים כשהבקשה הראשונה מגיעה. נמדד: 169 ms, והבקשה הראשונה לסיכום – 78–105 ms. בלי החימום, בהרצה אחת, הבקשה הראשונה לסיכום לקחה 22 שנ' (הגבול 30); זה לא חזר אחרי הוספת החימום, והסיבה לא הוכחה. החימום אינו מגן מפני כך ש־Windows מוציא את הזיכרון של SQL Server לדיסק בדקות שאחרי ההפעלה, במחשב עם מעט זיכרון פנוי: אז הבקשות הראשונות עלולות להיות איטיות, ובמקרה קיצוני להיכשל ב־timeout (30 שנ'). במסך תופיע הודעת שגיאה עם "נסה שוב" – ניסיון חוזר עובר, כי המסד כבר בזיכרון. כדאי לסגור אפליקציות כבדות לפני ההרצה הראשונה.
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
- כיבוי האתחול האוטומטי: ‏`Database:MigrateOnStartup` / ‏`Database:SeedOnStartup` / ‏`Database:WarmUpOnStartup` (מופעלים ב־`appsettings.Development.json`). ‏`WarmUpOnStartup` – לפני שה־API מתחיל להאזין הוא מבקש את הסיכום פעם אחת, כדי "לחמם" מסד קר ולמלא את ה־Cache (החלטה D‑48); ביומן: `Warming up…` ואחר כך `Warm-up done in N ms`. כשל בחימום נרשם כ־Warning ולא עוצר את ה־API.
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

כל השגיאות חוזרות בפורמט `ProblemDetails` אחד (כולל `traceId`); קלט לא תקין – `400` עם רשימת כל הבעיות.

### זמני שרת (`Server-Timing`)

כשהיא מופעלת, כל תשובה כוללת את הכותרת התקנית `Server-Timing` (החלטה D‑25), למשל:

```
Server-Timing: total;dur=70.3, db;dur=65.5;desc="2 queries"
Server-Timing: total;dur=0.6, db;dur=0.0;desc="0 queries", cache;desc="hit"     (summary מה־Cache)
```

`total` – זמן השרת כולו; `db` – זמן השאילתות ומספרן; `cache` – רק ב־summary (‏`hit`/`miss`). הכותרת מוצגת ב־DevTools של הדפדפן (Network ← Timing). היא חושפת זמנים פנימיים ואינה חלק מהדרישות, ולכן **כבויה כברירת מחדל – גם ב־Development**. הפעלה: משתנה הסביבה `ServerTiming__Enabled=true` לפני `dotnet run` (ב־PowerShell: ‏`$env:ServerTiming__Enabled = "true"`), או `"Enabled": true` תחת `ServerTiming` ב־`appsettings.Development.json`. פאנל הביצועים של ה־Frontend (גם הוא כבוי כברירת מחדל) מציג את זמני השרת רק כשהכותרת מופעלת.

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

חמישה סקריפטי אימות בתיקייה `scripts/` בודקים את ה־API מקצה לקצה מול מסד נתונים אמיתי. **ה־API חייב לרוץ** (ראו למעלה), והמסד חייב להיות זרוע (100,000 פניות ומשתמשי הדמו). כל סקריפט **מתחבר קודם כמשתמש דמו** ושולח את הטוקן בכל קריאה. כל אחד מסתיים ב־`ALL CHECKS PASSED` (קוד יציאה 0) או ברשימת הבדיקות שנכשלו.

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

**אין להשתמש ב־API בזמן שסקריפט אימות רץ** (לא ב־UI, לא בסקריפט אחר): הסקריפטים משווים מול SQL ישיר, ושינוי סטטוס של גורם אחר באמצע ריצה מייצר הבדל מדומה. `verify-summary-cache.js` מזהה שינוי סטטוס של משתמש אחר (שאינו `dana.cohen`) ונעצר עם קוד יציאה 2.

הסקריפטים שמשנים נתונים מתעדים את השינויים בהיסטוריה (תחת `dana.cohen` ו־`yossi.friedman`). כדי לחזור לנתונים המקוריים:

```
dotnet run --project src/RequestsManagement.API -- seed --reset
```

> במחשב עם מעט זיכרון פנוי, SQL Server עלול להאט מאוד או לא לענות (timeout של 30 שנ' ← `500`), ואז בדיקות בודדות נכשלות. מומלץ לסגור אפליקציות כבדות לפני ההרצה.

## מדידת ביצועים

`scripts/MeasureQueries.cs` (M8) מריץ ישירות מול SQL Server את ה־SQL ש־EF מייצר לתרחישי ה־API העיקריים (רשימה עם סינון משולב, מיונים, דף עמוק, חיפוש, Summary, היסטוריה ועדכון סטטוס שמבוטל ב־Rollback). לכל שאילתה הוא שומר logical reads ‏(`STATISTICS IO`), את ה־Execution Plan בפועל (קובץ `.sqlplan` ועץ אופרטורים בטקסט: Sort, ‏Key Lookup, ‏Memory Grant, ‏DOP) וזמנים חמים. ה־API לא צריך לרוץ. התוצאות והניתוח: `docs/PERFORMANCE.md` ב־Repo התיעוד.

```
dotnet run scripts/MeasureQueries.cs -- --out <dir> --label final
dotnet run scripts/MeasureQueries.cs -- --out <dir> --compare before final
```

- `--shape original` מודד את ה־SQL שלפני M8; ‏`--alternatives` מודד את חלופות השאילתה שנבחנו; ‏`--disable <index>` מכבה אינדקס אחד לריצה ותמיד בונה אותו מחדש בסוף (רק במסד בשם `RequestsManagement`, ולא את ה־Clustered Index).
- `SQL_SERVER` כמו בסקריפטים האחרים. הסקריפט לא משנה נתונים ולא מריץ פקודות ברמת המופע: ניקוי Plans רק למסד הזה (`ALTER DATABASE SCOPED CONFIGURATION CLEAR PROCEDURE_CACHE`).

> היסטוריית העבודה של M0 (הקמת ה־Solution) נשמרה ב־Repo של התיעוד, ממנו הקוד הועבר לכאן.
