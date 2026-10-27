# מערכת לניהול פניות – תכנון ותיעוד

מערכת לניהול פניות ובקשות המתקבלות מארגונים ומעסיקים, לעבודה של מספר משתמשים במקביל מול 100,000 פניות ויותר:
- איתור, סינון, חיפוש, מיון ודפדוף – כולם בצד השרת;
- עדכון סטטוס עם Optimistic Concurrency והיסטוריית שינויים;
- עדכון מרוכז (Bulk) של עד 100 פניות;
- לוח בקרה עם נתונים מסכמים, השמורים ב־Cache.

> זהו ה־Repo של **התכנון והתיעוד**, ונקודת הכניסה לבודקים. הקוד נמצא בשני Repos נפרדים (החלטה D‑16).

| Repo | תוכן |
|---|---|
| [requests-management-docs](https://github.com/naomy55978/requests-management-docs) (כאן) | תוכנית עבודה, החלטות, תיעוד, Issues, Milestones ו־[Project Board](https://github.com/users/naomy55978/projects/2) |
| [requests-management-be](https://github.com/naomy55978/requests-management-be) | Backend: ‏API, ‏BL, ‏DAL, ‏DTO, בדיקות, סקריפטי אימות ומדידה, CI |
| [requests-management-fe](https://github.com/naomy55978/requests-management-fe) | Frontend: אפליקציית Angular, בדיקות, CI |

> **[סיכום הפרויקט – PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)**: הפרויקט כולו במבט אחד, עם תרשימים – ארכיטקטורה, מודל הנתונים, השרת והלקוח, החלטות מרכזיות, תהליך העבודה ומבנה התיקיות.

## תוכן העניינים
1. [טכנולוגיות וגרסאות](#טכנולוגיות-וגרסאות)
2. [הרצה](#הרצה)
3. [בדיקות](#בדיקות)
4. [מבנה הפתרון](#מבנה-הפתרון)
5. [בסיס הנתונים, Concurrency, ‏Bulk ו־Cache](#בסיס-הנתונים-concurrency-bulk-ו-cache)
6. [שתי החלטות מרכזיות](#שתי-החלטות-מרכזיות)
7. [מגבלה ידועה ושיפור](#מגבלה-ידועה-ושיפור)
8. [היכן כל דרישה מכוסה](#היכן-כל-דרישה-מכוסה)
9. [תכנון העבודה](#תכנון-העבודה)
10. [שימוש בכלי AI](#שימוש-בכלי-ai)

## טכנולוגיות וגרסאות

| שכבה | טכנולוגיה |
|---|---|
| Backend | ‏‎.NET 10 (SDK ‏10.0.401, נקבע ב־`global.json`), ‏ASP.NET Core Web API, ‏EF Core 10.0.13 |
| בסיס נתונים | SQL Server – פותח מול SQL Server 2025 ו־LocalDB; ה־CI רץ מול SQL Server 2022 בקונטיינר |
| Frontend | Angular 22.2 עם Angular Material 22 (RTL, עברית), ‏RxJS 7.8, ‏TypeScript 6.0 |
| בדיקות | xUnit (יחידה ו־Integration מול SQL Server אמיתי), ‏Vitest (Frontend) |
| CI | GitHub Actions בכל אחד משני ה־Repos של הקוד |

## הרצה

### דרישות מקדימות
- **‎.NET SDK ‏10.0.401** ומעלה.
- **Node.js** ‏`^22.22.3` או `^24.15.0` (Node 20 לא מספיק ל־Angular 22).
- **SQL Server:** ברירת המחדל היא **LocalDB** ‏(`(localdb)\MSSQLLocalDB`), שמותקן עם Visual Studio או SQL Server Express. מופע אחר – ראו "מסד נתונים אחר" למטה.

### 1. Backend

```
git clone https://github.com/naomy55978/requests-management-be.git
cd requests-management-be
dotnet run --project src/RequestsManagement.API --launch-profile http
```

- בהרצה הראשונה ה־API יוצר את המסד `RequestsManagement`, מריץ את ה־Migrations ויוצר **100,000 פניות דמו** – אותם נתונים בכל הרצה (D‑17). אין צעד ידני.
- **ההרצה הראשונה לוקחת זמן.** ב־Console מופיעה ההודעה `Seeding 100,000 requests - this may take a few minutes on first run`, וה־API מתחיל להאזין רק בסוף. הרצות הבאות עולות תוך שניות.
  - **נמדד מ־clone נקי על LocalDB קר** (26.10.2026, פעמיים, ‏2.3–2.8 GB זיכרון פנוי): **30–40 שנ'** מ־`dotnet run` ועד שה־API מאזין, מתוכן 14–25 שנ' ל־Seed.
  - בהפעלה הראשונה אי־פעם של LocalDB במחשב, או במחשב עמוס, זה ארוך יותר – נמדדו גם יותר משתי דקות ([docs/SUBMISSION_CHECK.md](docs/SUBMISSION_CHECK.md)).
- **חימום בעלייה (D‑48):** אחרי ה־Seed ולפני שה־API מאזין הוא מבקש את הסיכום פעם אחת (`Warming up…` ← `Warm-up done in N ms` ביומן), כדי שהמסד והסיכום יהיו חמים כשהבקשה הראשונה מגיעה. נמדד: **169 ms**, והבקשה הראשונה מהדפדפן 78–105 ms.
  - בלי החימום, בהרצה אחת, הבקשה הראשונה לסיכום לקחה 22 שנ' (הגבול 30). לא הצלחנו לשחזר זאת אחרי הוספת החימום, והסיבה לא הוכחה.
  - החימום לא מגן מפני כך ש־Windows הוציא את הזיכרון של SQL Server לדיסק בדקות שאחרי ההפעלה, במחשב עם מעט זיכרון פנוי: אז הבקשה הראשונה עלולה להיות איטית, ובמקרה קיצוני להיכשל ב־timeout (30 שנ'). במסך תופיע הודעה עם "נסה שוב", וניסיון חוזר עובר.
- ה־API מאזין ב־http://localhost:5084, ו־Swagger UI זמין ב־http://localhost:5084/swagger.

### 2. Frontend

```
git clone https://github.com/naomy55978/requests-management-fe.git
cd requests-management-fe
npm ci
npm start
```

האפליקציה ב־http://localhost:4200. שרת הפיתוח מעביר את `/api` ל־API (Proxy), ולכן אין צורך ב־CORS.

### 3. התחברות

| משתמש | סיסמה |
|---|---|
| `dana.cohen` | `Demo123!` |
| `amit.navon` (לבדיקת `409` בשתי לשוניות) | `Demo123!` |

אלה נתוני דמו בלבד. מפתח החתימה של ה־JWT ב־`appsettings.Development.json` הוא מפתח פיתוח בלבד; בכל סביבה אחרת ה־API לא עולה בלעדיו (D‑10).

### מסד נתונים אחר
- **מופע SQL Server אחר:** לדרוס את מחרוזת החיבור במשתנה הסביבה `ConnectionStrings__RequestsDb` (או ב־user-secrets).
- **בלי LocalDB (למשל Mac/Linux):** SQL Server 2022 בקונטיינר – אותו Image שמולו רצות הבדיקות ב־CI. **הפקודה לא הורצה במחשב הפיתוח**, שאין בו Docker (D‑09, ‏D‑47):

```
docker run -d --name requests-sql -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=<סיסמה חזקה>" -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest
export ConnectionStrings__RequestsDb="Server=localhost,1433;Database=RequestsManagement;User Id=sa;Password=<אותה סיסמה>;TrustServerCertificate=True"
```

פרטים נוספים (יצירה מחדש של הנתונים, כיבוי האתחול האוטומטי): ‏[README של ה־Backend](https://github.com/naomy55978/requests-management-be#readme).

## בדיקות

| איפה | פקודה | מה |
|---|---|---|
| Backend | `dotnet test` | **145 בדיקות**: ‏73 יחידה ו־72 Integration – דרך HTTP מול SQL Server אמיתי, במסד זמני שנוצר ונמחק בכל ריצה (D‑21). חיבור: המשתנה `TESTS_SQL_CONNECTION`; בלעדיו – `Server=.` ואז LocalDB |
| Frontend | `npm test -- --watch=false` | **367 בדיקות** (Vitest), ‏`npm run lint`, ‏`npm run build` |
| CI | GitHub Actions | בכל Push, בשני ה־Repos; ב־Backend מול SQL Server 2022 בקונטיינר |

בדיקות משמעותיות לדרישות המבדק (§8):
- **תרחיש תקין** – סינון, חיפוש, מיון ודפדוף מול תוצאה שמחושבת מהנתונים עצמם ("Oracle"), לא מועתקת מהקוד: ‏`ReadRequestsTests`.
- **Validation** – קלט לא תקין לשליפה, ל־PATCH ול־Bulk: ‏`ValidationTests`, ‏`ReadRequestsTests`, ‏`BulkStatusTests`.
- **Concurrency** – ‏20 עדכונים בו־זמנית עם אותה גרסה: בדיוק אחד מצליח, 19 מקבלים `409`, ושורת היסטוריה אחת: ‏`ConcurrencyTests`.
- **Integration** – כל הבדיקות בתיקייה `Integration/` עוברות דרך ה־API האמיתי אל SQL Server.

ב־Backend יש גם **סקריפטי אימות** שמשווים את ה־API לשאילתות SQL ישירות על 100,000 הפניות, וסקריפט שמוכיח שאין Lost Update ב־1,000 בקשות מקבילות (‏[README של ה־Backend](https://github.com/naomy55978/requests-management-be#readme), "סקריפטי אימות").

## מבנה הפתרון

**Backend – ארבעה פרויקטים (D‑03):**

```
RequestsManagement.API   Controllers, טיפול שגיאות גלובלי (ProblemDetails), JWT, Server-Timing, Program.cs
RequestsManagement.BL    RequestService, חוקי מעברי הסטטוס (StatusTransitions), SummaryCache
RequestsManagement.DAL   Entities (internal), DbContext, Repository, Migrations, Seeder
RequestsManagement.DTO   מודלים לבקשות ולתשובות, כללי הוולידציה (ללא תלויות)
```

הזרימה: `Controller → IRequestService → RequestService → IRequestRepository → RequestRepository → DbContext`. ה־Entities לא יוצאות מה־DAL – השאילתות מחזירות DTOs ישירות (Projection), כך שנשלפות רק העמודות הנדרשות (D‑04). ‏DbContext, ‏Repository ו־Service הם Scoped, וה־Cache הוא Singleton. ‏CancellationToken עובר מה־Controller ועד ה־DB.

**Frontend:** ‏`core/` (גישה ל־API, התחברות, הודעות שגיאה), ‏`shared/` (רכיבי תצוגה קטנים), ‏`features/` (המסכים: התחברות, לוח בקרה, פניות). Components מציגים בלבד; Services ו־Stores מחזיקים את ה־HTTP ואת המצב. כל Component מחולק לשלושה קבצים (‎.ts / .html / .scss), וה־Lint אוכף זאת.

**המסכים:** לוח בקרה (נפתח אחרי ההתחברות – סיכומים, ‏Cache ‏HIT/MISS, כפתור "רענן"), ופניות (טבלה, סינון, חיפוש, עדכון סטטוס, Bulk, היסטוריה). פאנל "ביצועים" בסרגל מציג את זמני הבקשות האחרונות מכותרת `Server-Timing` (D‑23).

## בסיס הנתונים, Concurrency, ‏Bulk ו־Cache

### בסיס הנתונים והאינדקסים
**SQL Server** (D‑01) – בגלל `rowversion` המובנה ל־Optimistic Concurrency, טרנזקציות פשוטות ו־Execution Plans ברורים. כל הסינון, המיון והדפדוף נעשים ב־SQL: שאילתת `COUNT` ושאילתת דף עם `OFFSET/FETCH`, ולעולם לא טעינת כל הטבלה.

שבעה אינדקסים על `Requests` מלבד המפתח הראשי, וכל אחד נבחר במדידה (logical reads ו־Execution Plan לפני ואחרי, ועלות הכתיבה בעדכון סטטוס):
- `(Status, Priority, CreatedAt)`;
- `(AssignedTo, CreatedAt) INCLUDE (Status)`;
- `(OrganizationName, CreatedAt)`;
- `(CreatedAt)`, ‏`(UpdatedAt)`, ‏`(Priority)`, ‏`(Title)` – למיון בלי סינון.

הנימוק לכל אחד, ה־Plans, ה־Bottleneck וההצעות לשיפור – ב־[docs/PERFORMANCE.md](docs/PERFORMANCE.md) (החלטה D‑24). דוגמה: דף 1000 ירד מ־306,484 ל־525 logical reads, וחיפוש מ־480 ל־62 ms.

### Concurrency
- כל פנייה נושאת `version` (ה־`rowversion` של SQL Server, ב־base64). הלקוח שולח את הגרסה שראה.
- העדכון הוא **`UPDATE` מותנה אחד**: `WHERE Id = @id AND RowVersion = @v AND Status IN (<הסטטוסים שמהם מותר לעבור>)`. רק עדכון אחד יכול להצליח – ה־DB אוכף זאת, לא ה־UI (D‑06).
- שורת ההיסטוריה (`RequestId`, ‏`PreviousStatus`, ‏`NewStatus`, ‏`ChangedAt`, ‏`ChangedBy` מתוך הטוקן) נכתבת **באותה טרנזקציה**. ‏`UpdatedAt` ו־`RowVersion` מתעדכנים יחד.
- אם לא עודכנה שורה: הפנייה לא קיימת ← `404`; הגרסה השתנתה ← **`409`** עם המצב והגרסה הנוכחיים; המעבר אסור ← `422` עם המעברים המותרים (D‑07).
- במסך: תשובת `409` מרעננת את השורה מגוף התשובה, ואפשר לנסות שוב מיד (D‑37).

### Bulk
`POST /api/requests/bulk-status` מעדכן עד 100 פניות לאותו סטטוס. נבחר **Partial Success** (D‑08, ‏D‑19):
- כל פנייה עוברת בטרנזקציה משלה, דרך אותו קוד של העדכון הבודד;
- התשובה היא `200` עם תוצאה לכל פריט, בסדר הבקשה: `Updated`, ‏`NotFound`, ‏`Conflict` או `InvalidTransition`, וכן `succeeded` ו־`failed`;
- בקשה לא תקינה (ריקה, מעל 100, מזהה כפול) ← `400`, ושום דבר לא נשמר.

הנימוק: כל פנייה עצמאית, וכשל באחת (למשל עדכון מתחרה) לא צריך לבטל את העבודה על האחרות. פירוט ודוגמה – [docs/API.md](docs/API.md).

### Cache ו־Invalidation
- ה־summary (ספירה לפי סטטוס ועדיפות, וארגונים מובילים) נשמר ב־`IMemoryCache` ל־**60 שניות** (D‑11, ‏D‑20). זו Aggregation על כל הטבלה, שנקראת בכל כניסה ללוח הבקרה.
- **Invalidation** אחרי כל שינוי סטטוס שנשמר (בודד ו־Bulk), רק אחרי ה־Commit. מונה "דור" מונע מקורא איטי לשמור תוצאה ישנה אחרי ה־Invalidation.
- **כמה מופעי שרת:** Cache בזיכרון הוא מקומי לכל תהליך. האפשרויות (Redis, ‏HybridCache, ‏Pub/Sub, טבלת סיכום) וההמלצה – ב־[docs/CACHE.md](docs/CACHE.md).

## שתי החלטות מרכזיות

כל 48 ההחלטות, עם נימוק וחלופות, נמצאות ב־[docs/DECISIONS.md](docs/DECISIONS.md). שתיים מרכזיות:

1. **Concurrency באכיפת ה־DB – `UPDATE` מותנה על `rowversion` (D‑06).**
   - **חלופות שנשקלו:** Pessimistic Locking – פוגע במקביליות, כי משתמש שפתח פנייה נועל אותה; בדיקה ב־UI בלבד – לא מונעת Lost Update; קריאה ואז כתיבה ב־EF – שתי פעולות עם חלון ביניהן.
   - **למה כך:** ה־UPDATE המותנה אטומי, ובדיקת המעבר המותר נעשית באותה פקודה.
2. **Bulk: ‏Partial Success ולא All‑or‑Nothing (D‑08, ‏D‑19).**
   - **החלופה:** טרנזקציה אחת לכולם – פריט אחד שהתעדכן בינתיים ע״י אחר היה מבטל את כל העבודה של המשתמש.
   - **שנדחה גם:** עיבוד מקבילי – ‏DbContext אינו Thread‑Safe, והוא מסכן Deadlocks בלי תועלת מדידה (100 פריטים ≈ 0.2 שנ').

## מגבלה ידועה ושיפור

- **מגבלה:** החיפוש החופשי (`LIKE '%x%'` בכותרת ובשם הארגון) אינו יכול להשתמש באינדקס ומבצע **סריקה מלאה**. ב־100,000 פניות הוא לוקח כ־52 ms אחרי ההשוואה הבינארית (D‑24); ב־מיליון פניות ומעלה זה יהיה ה־Bottleneck.
- **שיפור:** אינדקס n‑grams (טבלת trigrams) או Full‑Text Search. שניהם לא מומשו: Full‑Text לא זמין ב־LocalDB וב־CI, ונותן סמנטיקת מילים ולא "מכיל"; n‑grams מוסיף טבלה ועלות כתיבה.

מגבלות ושיפורים נוספים (טוקן שלא ניתן לביטול, Cache מקומי למופע, Keyset Pagination ועוד) – ב־[docs/DECISIONS.md](docs/DECISIONS.md), בפרק "מגבלות ידועות ושיפורים".

## היכן כל דרישה מכוסה

| סעיף במבדק | מימוש | תיעוד | בדיקות |
|---|---|---|---|
| §1 שליפה: דפדוף, סינון, חיפוש, מיון, Aggregations, ‏PageSize, ‏CancellationToken, ‏DTOs | `RequestsController`, ‏`RequestRepository`, ‏`RequestFilter` | [PERFORMANCE.md](docs/PERFORMANCE.md) פרקים 2, 5, 6; D‑04, ‏D‑12, ‏D‑18 | `ReadRequestsTests`, ‏`ValidationTests`, ‏`verify-read-api.js` |
| §2 עדכון סטטוס ו־Concurrency | `RequestRepository.UpdateStatusAsync`, ‏`StatusTransitions` | D‑05, ‏D‑06, ‏D‑07 | `UpdateStatusTests`, ‏`ConcurrencyTests`, ‏`StatusTransitionsTests`, ‏`ConcurrencyProof.cs` |
| §3 היסטוריה | טבלת `RequestStatusHistory`, ‏`GET /api/requests/{id}/history` | D‑06 | `UpdateStatusTests` |
| §4 Bulk | `POST /api/requests/bulk-status` | [API.md](docs/API.md), ‏D‑08, ‏D‑19 | `BulkStatusTests`, ‏`verify-bulk-status.js` |
| §5 Angular | `requests-list.store.ts` (זרם אחד, `debounceTime`, ‏`switchMap`), מצבי טעינה/ריק/שגיאה, ‏409, לוח בקרה, היסטוריה | D‑26–D‑45 | 367 בדיקות FE |
| §6 ביצועים | אינדקסים (Migration `TuneIndexes`), ‏Deferred Join, חיפוש בינארי | [PERFORMANCE.md](docs/PERFORMANCE.md), ‏D‑24 | `MeasureQueries.cs` |
| §7 Cache | `SummaryCache` | [CACHE.md](docs/CACHE.md), ‏D‑11, ‏D‑20 | `SummaryCacheTests`, ‏`RequestServiceCacheTests`, ‏`SummaryTests`, ‏`verify-summary-cache.js` |
| §8 בדיקות | `tests/RequestsManagement.Tests` | D‑21 | 145 BE + 367 FE, ‏CI |
| §9 תכנון עבודה | Issues, Milestones, ‏[Project Board](https://github.com/users/naomy55978/projects/2) | [WORK_PLAN.md](docs/WORK_PLAN.md) | – |
| §10 איכות קוד | ‏4 שכבות, ‏DI, ‏ProblemDetails (`GlobalExceptionHandler`), ולידציה אחת (D‑18), Logging בלי מידע רגיש | [DECISIONS.md](docs/DECISIONS.md) | – |
| §11 תיעוד | README זה, ‏READMEs של ה־Repos, ‏`docs/` | – | – |

מטריצה מלאה של דרישה ← משימות: [docs/WORK_PLAN.md](docs/WORK_PLAN.md).

## תכנון העבודה
- [docs/WORK_PLAN.md](docs/WORK_PLAN.md) – תוכנית העבודה: עשרה Milestones (M0–M9), סדר ביצוע ותלויות, הערכת מאמץ לכל משימה (סה״כ 53 שעות), ומטריצת דרישה ← משימות. כוללת משימות שאינן קוד: תכנון, ‏DB, מדידה, תיעוד והגשה.
- [Issues](https://github.com/naomy55978/requests-management-docs/issues?q=is%3Aissue) – משימה לכל יחידת עבודה, עם תיאור, תוצר מצופה, קריטריוני קבלה, מאמץ, תלויות וסעיף המבדק. כל Commit בקוד מפנה ל־Issue שלו.
- [Project Board](https://github.com/users/naomy55978/projects/2) ו־[Milestones](https://github.com/naomy55978/requests-management-docs/milestones).
- [PROJECT_TRACKING_RequestsManagement.md](PROJECT_TRACKING_RequestsManagement.md) – יומן הפרויקט: אפיון, כל ההחלטות, מה בוצע בכל שלב ואיך אומת, סיכונים וצעדים הבאים.

## שימוש בכלי AI

בפרויקט נעשה שימוש ב־**Claude Code** (Anthropic) לכתיבת קוד, בדיקות ותיעוד, וב־**אפליקציית Claude** לשיחת תכנון וסקירה נפרדת, כמותר במבדק. האחריות על הקוד, ההחלטות והבדיקה נשארה אצל המפתחת.

### איך עבדנו
- **חלוקת תפקידים בין מודלים:** ‏Opus לתכנון, ארכיטקטורה, Concurrency, ביצועים וסקירת קוד; ‏Sonnet לכתיבת קוד ובדיקות.
- **כל משימה באותו סדר:** הבנה ושאלות ← תוכנית ← **אישור מפורש של המפתחת** ← ביצוע ← אימות ← Commit עם הפניה ל־Issue. שום קוד לא שונה לפני אישור.
- **זיכרון משותף:** קובץ המעקב שימש כמקור אמת בין שיחות. כל החלטה נרשמה בו עם הסיבה והחלופות.

### מה הוחלט ע״י המפתחת
- בלי רמז לפרטי ההתחברות במסך הכניסה, גם לא בפיתוח (D‑10);
- לוח הבקרה כמסך הפתיחה (D‑43);
- נתוני דמו בעברית ושמות ארגונים מעורבים (D‑33);
- Repos ציבוריים בהגשה (D‑46);
- דחיית תיקונים שלא היו שווים את השינוי (#41).

המפתחת גם בדקה ידנית את תיקוני הממשק: לוח הבקרה והניווט, פאנל הביצועים, ויישור טקסט מעורב עברית/אנגלית.

### איך נבדק מה שה־AI כתב – לא על סמך אמון
- **Oracle מול SQL:** סקריפטי האימות משווים כל סינון, חיפוש, מיון ודפדוף לשאילתת SQL ישירה על 100,000 הפניות. בבדיקות ה־Integration התוצאה הצפויה מחושבת מהנתונים ולא מועתקת מהקוד (D‑21).
- **בדיקות מוטציה:** שוברים את הקוד בכוונה ומוודאים שהבדיקה נכשלת. למשל:
  - הסרת תנאי `RowVersion` מהעדכון ← 5 בדיקות נכשלות;
  - הסרת ה־Invalidation ← 5 בדיקות נכשלות;
  - Guard שמאשר תמיד ← 2 בדיקות נכשלות.
- **הוכחת Concurrency:** ‏1,000 בקשות PATCH מקבילות ← בדיוק 50 הצלחות ו־950 תשובות `409`, ושורת היסטוריה אחת לכל פנייה.
- **דפדפן אמיתי:** מדידות בדפדפן לפני ואחרי תיקון (מיקום הפאנל, יישור טקסט, מיקוד), ולא רק בדיקות יחידה.

### דוגמאות למה שהבדיקה מצאה ותוקן
- ולידציה של פריטי Bulk החזירה מפתחות שגיאה ב־PascalCase (`items[1].Id`), בניגוד לשאר ה־API – הועברה ל־`Validate` (D‑19).
- זמן ה־DB בכותרת `Server-Timing` כלל רק את קריאת השורות ולא את ביצוע השאילתה (חיפוש: 4 ms במקום 66) – תוקן (D‑25).
- בדיקת המרוץ של ה־Cache לא זיהתה בהתחלה את היעדר מונה ה"דור", כי ה־Cache היה מלא – הבדיקה תוקנה ואומתה בנטרול המונה (D‑20).
- אינדקס עם מפתח `DESC` לא שירת מיון `X DESC, Id DESC` – כל המפתחות שונו לסדר עולה (D‑24).
- ה־Native Date Adapter פירש תאריך מוקלד `dd/MM/yyyy` כ־`MM/dd` – השדות הפכו לבחירה מלוח השנה בלבד (D‑29).
- בסקירת ה־UI נמצאה בדיקת מיקוד שעברה גם כשהקוד שבור – היא תוקנה, והמיקוד האמיתי אומת בדפדפן (#41).
