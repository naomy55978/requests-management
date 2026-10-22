# קובץ מעקב – מערכת ניהול פניות (מבדק Full Stack רמה ג׳)

---

## 1. מטרה
פיתוח מערכת לניהול פניות מארגונים (‎.NET 10 + Angular 22 + SQL Server) העומדת **בכל** דרישות מסמך המבדק, ברמה שתקבל ציון מלא. המטרה כוללת גם הצגה מובנית של התכנון וההחלטות, כך שהמפתח/ת יוכל/תוכל להסביר כל החלטה.

## 2. כללי עבודה
- כל הכללים ב־`CLAUDE.md`: להציג הבנה, לשאול שאלות, להציע תוכנית, **לחכות לאישור מפורש** לפני שינוי קוד; לא לשנות התנהגות שלא קשורה למשימה; קוד קריא עם הערות במקום הנדרש; בלי מורכבות מיותרת.
- **כל החלטה משמעותית** נרשמת בסעיף 5 עם הסיבה והחלופות שנשקלו, ובהמשך ב־`docs/DECISIONS.md`.
- **בתחילת כל משימה** מציינים את המודל המומלץ (שורה "🔁 מודל מומלץ: …"). העקרון: Opus לתכנון, ארכיטקטורה, Concurrency, ביצועים וסקירה; Sonnet לקוד שוטף ולבדיקות; Haiku לקוד חוזר ופשוט.
- תיעוד המשתמש (README וכו') **בעברית**; קוד, שמות ו־Commits באנגלית.
- **הנחיות (Prompts) ל־Claude Code נכתבות באנגלית.** השיחה עם המפתחת והתיעוד למשתמש – בעברית.
- עבודה בצעדים קטנים: כל Milestone מסתיים במצב שניתן לבנות, להריץ ולבדוק.

## 3. רקע – תמצית דרישות המבדק ומשקלן
| תחום | משקל | עיקר |
|---|---|---|
| Backend .NET | 17 | שכבות, DI ו־Lifetimes, async, CancellationToken, טיפול שגיאות גלובלי, Logging |
| Angular | 15 | הכל בצד השרת, debounce, ביטול בקשות (switchMap), Loading/Empty/Error, טיפול ב־409, Components מול Services |
| REST API | 13 | Pagination, סינון משולב, חיפוש, מיון ב־3 שדות, Validation, הגבלת PageSize, DTOs, Bulk |
| DB וביצועים | 13 | מודל, אינדקסים מנומקים, Aggregations, Execution Plan לשתי פעולות, Bottleneck |
| Concurrency + Audit | 11 | אכיפה ב־DB, ‏409, אין Lost Update, היסטוריה |
| איכות קוד | 9 | תחזוקתיות, הפרדה, בלי Over‑Engineering |
| תכנון עבודה | 8 | Issues, תלויות, סדר, הערכת מאמץ, משימות שאינן קוד |
| בדיקות | 6 | ≥4, כולל Integration ו־Concurrency |
| Cache | 4 | Expiration, ‏Invalidation, נימוק, Scale‑out |
| תיעוד | 4 | README, החלטות + חלופות, מגבלה ושיפור, שימוש ב־AI |

**מורידים ציון:** סינון/מיון/דפדוף בצד הלקוח; Concurrency רק ב־UI; Cache בלי Invalidation; חלוקת משימות שטחית; Over‑Engineering; הגשת ZIP.

## 4. סביבת פיתוח (נבדק 22.10.2026)
- Windows; ‏‎.NET SDK ‎10.0.401 (וגם 9.0.301)
- SQL Server 2025, מופע מקומי `MSSQLSERVER` (רץ) + SSMS 22
- Node v24.22.1; ‏Claude Code 2.1.141; ‏Git + GitHub CLI
- **אין Docker** – הוחלט לא להתקין (ראה D‑09)
- npm 10.9.1 (ב־PowerShell יש להריץ `npm.cmd` עקב Execution Policy, או לתקן עם `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`)
- נתיב הפרויקט: `<project-root>` (תיקייה מקומית במחשב הפיתוח) – תיקייה רגילה (**לא** Repo), מכילה רק את `CLAUDE.md`, מסמך המבדק (PDF) ושלושת ה־Repos (D‑16):
  - `<project-root>/requests-management-docs` ← https://github.com/naomy55978/requests-management-docs (כולל קובץ זה)
  - `<project-root>/requests-management-be` ← https://github.com/naomy55978/requests-management-be
  - `<project-root>/requests-management-fe` ← https://github.com/naomy55978/requests-management-fe
- Claude Code נפתח תמיד ב־`<project-root>`, כדי ש־`CLAUDE.md` ייטען ושלושת ה־Repos יהיו זמינים.
- `global.json` ב־Repo של ה־Backend מקבע SDK ‏10.0.401 (מותקן גם SDK 9)
- SQL Server LocalDB מותקן: המופע `MSSQLLocalDB` הוא SQL Server 2025 (17.0.4025.3); מותקנת גם גרסת LocalDB 2019. זו ברירת המחדל לבודקים (D‑17).
- במחשב הפיתוח: user-secrets של ה־API מפנה את `ConnectionStrings:RequestsDb` למופע המקומי (`Server=.;Database=RequestsManagement`).
- `dotnet-ef` ‏10.0.13 כ־Local Tool (`dotnet-tools.json` בשורש ה־BE; `dotnet tool restore`). פקודת Migration: `dotnet ef migrations add <Name> --project src/RequestsManagement.DAL --startup-project src/RequestsManagement.API --output-dir Migrations`

## 5. החלטות
| # | החלטה | סיבה | חלופות שנשקלו |
|---|---|---|---|
| D‑01 | SQL Server | `rowversion` מובנה ל־Optimistic Concurrency; Execution Plan ברור; מותקן מקומית | MongoDB (אין טרנזקציות פשוטות כמו כאן, Concurrency ידני), PostgreSQL |
| D‑02 | ‎.NET 10 LTS, Angular 22 + Angular Material | גרסאות עדכניות עם תמיכה ארוכה; Material נותן טבלה, דפדוף ומיון מוכנים | .NET 9 (STS), PrimeNG |
| D‑03 | 4 פרויקטי Backend: API, BL, DAL, DTO | מבנה מוכר וברור; זרימה `Controller → IRequestService → RequestService → IRequestRepository → RequestRepository → DbContext` | שכבת Repository נוספת ב־API (נדחתה: שכבה שרק מעבירה קריאות = שכפול; השם Repository מקובל רק לגישה לנתונים) |
| D‑04 | DTO מוכר לכל השכבות, כולל DAL; Entities לא יוצאות מה־DAL | מאפשר Projection ישיר ל־DTO בשאילתה – נשלפות רק העמודות הנדרשות | מיפוי ב־BL בלבד (טוען יותר עמודות) |
| D‑05 | מעברי סטטוס: New→InProgress/Waiting; InProgress→Waiting/Completed; Waiting→InProgress/Completed; Completed סופי; אותו סטטוס חסום | המבדק לא מגדיר מעברים, רק דורש לחסום מעבר אסור; מטריצה פשוטה והגיונית לזרימת טיפול | פתיחה מחדש מ־Completed (נדחה – לשמור פשטות) |
| D‑06 | Concurrency: ‏UPDATE מותנה `WHERE Id=@id AND RowVersion=@v` + הכנסת Audit באותה טרנזקציה; 0 שורות → בדיקה אם קיים → 404 או 409 | אכיפה ברמת DB, אטומי, מונע Lost Update | Pessimistic Locking (פוגע במקביליות), בדיקה ב־UI בלבד (לא מספיק) |
| D‑07 | קודי שגיאה: 400 קלט פגום, 404 לא קיים, 409 עדכון מתחרה (כולל הגרסה הנוכחית), 422 מעבר סטטוס אסור; כולם ProblemDetails | הבחנה ברורה ללקוח בין סוגי הכשל | 400 לכל שגיאת עסק |
| D‑08 | Bulk: ‏Partial Success, עד 100 פריטים `{id, version}`, טרנזקציה לכל פריט, תשובה 200 עם `succeeded`, `failed` ותוצאה לכל פריט (Updated / NotFound / Conflict / InvalidTransition) | כל פנייה יחידה עצמאית – כשל באחת לא אמור לחסום את השאר | All‑or‑Nothing (משתמש מאבד את כל העבודה בגלל התנגשות אחת) |
| D‑09 | בלי Docker מקומי; בדיקות Integration מול SQL Server המקומי (DB זמני לכל ריצה); ב־GitHub Actions מול SQL Server בקונטיינר; בלי docker-compose | התקנת Docker במחשב ארגוני כבדה; CI מוכיח שהבדיקות עוברות | Testcontainers מקומי; docker-compose שלא נבדק |
| D‑10 | ChangedBy מתוך JWT: התחברות פשוטה עם משתמשי דמו מה־Seed | השרת קובע מי ביצע את השינוי – אי אפשר לזייף; מרשים בלי ניהול משתמשים מלא | Header חופשי מהלקוח (ניתן לזיוף); Identity מלא (Over‑Engineering) |
| D‑11 | Cache: ‏`IMemoryCache` ל־summary, ‏Expiration ‏60 שניות, Invalidation בכל שינוי סטטוס (בודד ו־Bulk) | ה־summary יקר (Aggregation על כל הטבלה) ונקרא בכל טעינת מסך; Redis מתועד בלבד | Redis / HybridCache בפועל (Over‑Engineering למופע יחיד) |
| D‑12 | Pagination לפי Offset + TotalCount; חיפוש `LIKE '%x%'` | פשוט ומתאים ל־UI עם מספרי עמודים; ה־Bottleneck יתועד ב־PERFORMANCE.md | Keyset Pagination, Full‑Text Index (יוצעו כשיפור) |
| D‑13 | Seed: ‏SqlBulkCopy, ‏Random עם Seed קבוע, 100,000 רשומות, הרצה חוזרת עם `--reset` | מהיר, נתונים זהים בכל הרצה – מדידות ניתנות להשוואה | הכנסה דרך EF (איטי) |
| D‑14 | תכנון: GitHub Issues + Project Board + Milestones, וגם `docs/WORK_PLAN.md` | הבודקים רואים תכנון אמיתי ומעקב | מסמך בלבד |
| D‑15 | Repos **פרטיים** (שלושה – ראו D‑16); לפני ההגשה – הזמנת הבודקים כ־Collaborators **לשלושת ה־Repos** (או הפיכתם לציבוריים) | בקשת המפתחת לשמור על פרטיות עד ההגשה | Repo ציבורי מההתחלה |
| D‑16 | שלושה Repos נפרדים: `requests-management-docs` (תכנון ותיעוד, Issues, Milestones, נקודת הכניסה לבודקים), `requests-management-be` (Backend + CI), `requests-management-fe` (Frontend); כולם מקושרים לאותו Project Board | מחזור חיים ו־CI נפרדים לכל Stack, כמקובל בארגונים | Repo אחד לכל הקוד – מעט נוח יותר לבודקים; החיסרון מטופל ע״י README ב־Repo התיעוד שמפנה לשני ה־Repos האחרים |
| D‑17 | מסד נתונים לבודקים: בעליית ה־API מריצים Migrations ו־Seed (100K, דטרמיניסטי) אם המסד ריק; נשלט ע״י `Database:MigrateOnStartup` ו־`Database:SeedOnStartup` (כבויים כברירת מחדל, מופעלים ב־`appsettings.Development.json`; בדיקות ה־Integration ב־M6 יכבו את ה־Seed). מחרוזת ברירת המחדל: ‏`(localdb)\MSSQLLocalDB`, ניתנת לדריסה ב־user-secrets או במשתנה הסביבה `ConnectionStrings__RequestsDb`. ‏`seed --reset` מוחק מסד רק אם שמו בדיוק `RequestsManagement` | הבודק מקבל מסד מוכן עם נתונים זהים בהרצה הראשונה, בלי צעד ידני ובלי סודות ב־Repo; הדגלים מאפשרים לכבות את האתחול בבדיקות ובסביבות אחרות; ההגנה ב־`--reset` מונעת מחיקת מסד אחר על מופע משותף | קובץ גיבוי (‎.bak) – גיבוי מ־SQL Server 2025 לא ניתן לשחזור בגרסאות ישנות, ודורש שחזור ידני; מסד משותף בענן – פרטי התחברות ב־Repo, והבודקים ישנו נתונים משותפים זה לזה |
| D‑18 | מנגנון ולידציה אחד לכל הפרויקט: ‏DataAnnotations על ה־DTOs (`Range`, `StringLength`, `EnumDataType`, ו־`IValidatableObject` לכללים חוצי־שדות), הנאכף ע״י ה־model validation המובנה של ASP.NET. אותו מנגנון חל על Query (ב־M2) ועל Body (ב־M3–M4: PATCH, Bulk). כל שגיאת קלט – גם שלנו וגם מובנית (JSON פגום, ערך enum לא חוקי) – חוזרת כ־`ValidationProblemDetails` באותו פורמט, עם מפתחות camelCase ו־`traceId`. שגיאות עסק (409, 422) נפרדות (D‑07) | מנגנון אחד = פורמט שגיאה אחד ללקוח; ה־DTO הוא מקור יחיד לכללי הקלט וגם לתיעוד ה־OpenAPI; אין כפל כללים בין ה־Controller ל־BL ואין תלות חדשה | ‏FluentValidation (תלות נוספת ומנגנון שני לצד ה־binding המובנה – Over‑Engineering לכמה DTOs); ולידציה ידנית ב־BL (שני פורמטי שגיאה: אחד לשגיאות ה־binding ואחד לשלנו) |

## 6. אפיון

### מבנה הפתרון (שלושה Repos – D‑16)
```
<project-root>/                      תיקייה רגילה (לא Repo): CLAUDE.md, מסמך המבדק (PDF)
  requests-management-docs\          תכנון ותיעוד בלבד (Issues, Milestones, Project Board)
    README.md                        נקודת הכניסה לבודקים
    PROJECT_TRACKING_RequestsManagement.md
    docs/  DECISIONS.md, WORK_PLAN.md, PERFORMANCE.md, API.md
  requests-management-be\            Backend
    RequestsManagement.sln, global.json, .github/workflows/
    src/
      RequestsManagement.API   Controllers, Middleware (ProblemDetails), Auth (JWT), Program.cs
      RequestsManagement.BL    IRequestService/RequestService, StatusTransitions, Validators, Cache
      RequestsManagement.DAL   Entities, AppDbContext, IRequestRepository/RequestRepository, Migrations, Seeder
      RequestsManagement.DTO   Request/Response DTOs, RequestFilter, PagedResult (ללא תלויות)
    tests/
      RequestsManagement.Tests Unit/ + Integration/
  requests-management-fe\            Frontend – אפליקציית Angular 22 בשורש ה־Repo (נוצרת ב־M7)
```
**מוסכמה:** ה־Issues נמצאים ב־`requests-management-docs`. Commit ב־BE/FE סוגר Issue עם הפניה מלאה, למשל `Closes naomy55978/requests-management-docs#12`; ב־Repo התיעוד מספיק `Closes #12`.
**כללים:** Controllers פונים רק לממשקי BL; ה־API מפנה ל־DAL רק לרישום DI; ‏Lifetimes – ‏DbContext, ‏Repository ו־Service ב־Scoped, ‏Cache ב־Singleton; ‏CancellationToken מה־Controller ועד ה־DB; חוקי מעברי סטטוס במקום אחד ב־BL.

### מודל נתונים
- **Requests:** ‏Id int identity, ‏Title nvarchar(200), ‏OrganizationName nvarchar(150), ‏Status tinyint, ‏Priority tinyint, ‏AssignedTo nvarchar(100), ‏CreatedAt datetime2, ‏UpdatedAt datetime2, ‏RowVersion rowversion
- **RequestStatusHistory:** ‏Id, ‏RequestId (FK), ‏PreviousStatus, ‏NewStatus, ‏ChangedAt, ‏ChangedBy
- **Users:** משתמשי דמו
- **אינדקסים ראשוניים (יאומתו במדידה):** ‏`(Status, Priority, CreatedAt DESC)` עם INCLUDE; ‏`(AssignedTo, Status)`; ‏`(OrganizationName)`; ‏`(CreatedAt)`; ‏History: ‏`(RequestId, ChangedAt)`

### חוזה API
| Endpoint | תיאור | קודים |
|---|---|---|
| `POST /api/auth/login` | התחברות דמו → JWT | 200/401 |
| `GET /api/requests` | page, pageSize (≤100), status[], priority[], organization (התחלת שם), assignedTo (או הערך `unassigned` לפניות ללא מטפל), createdFrom, createdTo (ימי UTC שלמים), search (Title+OrganizationName), sortBy (createdAt/updatedAt/priority/status/title), sortDir | 200/400 |
| `GET /api/requests/{id}` | פנייה בודדת | 200/404 |
| `GET /api/requests/summary` | Aggregations: ספירה לפי סטטוס ועדיפות; ארגונים מובילים בפניות פתוחות (Cache) | 200 |
| `PATCH /api/requests/{id}/status` | `{newStatus, version}` | 200/400/404/409/422 |
| `GET /api/requests/{id}/history` | היסטוריית שינויים | 200/404 |
| `POST /api/requests/bulk-status` | `{newStatus, items:[{id, version}]}` עד 100 | 200/400 |

**מוסכמות API (נקבעו ב־M2):** פרמטרים ו־JSON ב־camelCase; Enums כמחרוזות (`"InProgress"`), ומספרים מתקבלים כקלט; כל התאריכים UTC עם `Z`; `version` הוא ה־RowVersion כ־base64; כל שגיאה היא ProblemDetails עם `traceId` (400 = `ValidationProblemDetails` עם רשימת כל הבעיות, מפתחות camelCase); דף מעבר לסוף ← 200 עם `items` ריק; ‏Swagger UI ב־`/swagger` (Development בלבד).

### Angular
מסך רשימה (mat-table + mat-paginator + mat-sort, הכל בצד השרת), טופס סינון, חיפוש עם debounce ו־switchMap, כרטיסי summary, מצבי Loading/Empty/Error, עדכון סטטוס עם טיפול ב־409 (הודעה + רענון השורה), בחירה מרובה ל־Bulk עם הצגת התוצאה לכל פריט, חלון היסטוריה, מסך Login ו־Interceptor ל־JWT ולשגיאות. הפרדה: Components לתצוגה, Services ל־HTTP ולמצב.

## 7. תוכנית עבודה
| # | Milestone | תוצר | מאמץ | תלוי ב־ | מודל |
|---|---|---|---|---|---|
| M0 | הקמה ותכנון: שלושה Repos פרטיים (docs/be/fe – D‑16), ‏gh auth, ‏Solution + 4 פרויקטי Backend + פרויקט בדיקות + הפניות, ‏.gitignore, ‏Project Board, ‏Milestones, ‏Issues, שלד docs, ‏CI ל־build | Repo Backend שעובר build ב־CI; Repo תיעוד עם תכנון מלא | 3.75 ש' (כולל 0.75 ש' לפיצול ה־Repos, #50) | – | Opus |
| M1 | DB ונתונים: Entities, ‏DbContext, ‏Migration, אינדקסים, Seeder | DB עם 100K רשומות | 4 ש' | M0 | Opus לתכנון, Sonnet לקוד |
| M2 | API שליפה: סינון, מיון, דפדוף, Validation, ‏DTOs, ‏ProblemDetails, ‏Logging, ‏summary | GET פעיל + Swagger | 6 ש' | M1 | Sonnet |
| M3 | עדכון ו־Concurrency: מעברים, PATCH, ‏409, ‏Audit, ‏history, ‏JWT | עדכון בטוח | 5 ש' | M2 | Opus |
| M4 | Bulk | Endpoint + תיעוד | 3 ש' | M3 | Sonnet |
| M5 | Cache + Invalidation | Cache מתועד | 2 ש' | M3 | Sonnet |
| M6 | בדיקות: יחידה, Integration, ‏Concurrency, ‏Bulk, ‏Cache; ‏CI עם SQL Server | בדיקות ירוקות ב־CI | 5 ש' | M2–M5 | Sonnet |
| M7 | Angular – כל המסכים | UI מלא | 12 ש' | M2–M5 | Sonnet + Opus לסקירה |
| M8 | ביצועים: STATISTICS IO/TIME + Execution Plan לפני/אחרי לשתי פעולות, Bottleneck | PERFORMANCE.md | 3 ש' | M1–M2 | Opus |
| M9 | תיעוד והגשה: README בעברית, החלטות, מגבלה ושיפור, שימוש ב־AI, בדיקה מקצה לקצה | הגשה מלאה | 4 ש' | הכל | Sonnet + Opus לסקירה |

סה"כ כ־47.75 שעות (47 בתכנון המקורי + 0.75 לפיצול ה־Repos). כל Issue כולל: תיאור, תוצר מצופה, הערכת מאמץ, תלויות, וסעיף מסמך הדרישות שהוא מכסה.

## 8. עבודה שהושלמה
- 22.10.2026 – קריאת הדרישות, אפיון, קבלת החלטות D‑01 עד D‑15, בדיקת סביבה, יצירת קובץ זה, התחברות ל־GitHub.
- 22.10.2026 – **M0 הושלם:**
  - Repo פרטי: https://github.com/naomy55978/requests-management (כיום `requests-management-docs` – ראו פיצול ה־Repos למטה)
  - `RequestsManagement.sln` (פורמט `.sln` לפי האפיון, לא `.slnx`) עם API/BL/DAL/DTO תחת `src/` ו־Tests תחת `tests/` (תיקיות `Unit/`, `Integration/`), הפניות לפי סעיף 6, קוד דוגמה של התבניות הוסר. ‏`requests-web` ייווצר ב־M7.
  - `.gitignore` (‏.NET + Node/Angular); מסמך המבדק (PDF) מוחרג מה־Repo בכוונה.
  - CI: `.github/workflows/build.yml` – restore + build לפי `global.json`.
  - `docs/DECISIONS.md` (‏D‑01..D‑15 כלשונן), `docs/WORK_PLAN.md` (נוצר מאותו מקור כמו ה־Issues; כולל מטריצת מעקב דרישה ← Issues).
  - GitHub: ‏10 Milestones (M0–M9), ‏49 Issues בעברית (‏47 ש') עם תיאור, תוצר, קריטריוני קבלה, מאמץ, תלויות, סעיף במבדק ומודל מומלץ; תלויות גם כקשרי *blocked by* מובנים.
  - Labels: סוג עבודה (`backend`, `frontend`, `database`, `testing`, `docs`, `devops`, `planning`, `non-code`, `security`) + סעיף דרישה (`req-01..req-11`, `req-entity`, `req-submission`).
  - Project Board: https://github.com/users/naomy55978/projects/2 – מקושר ל־Repo, כל ה־Issues עם שדה `Estimate (h)`.
- 22.10.2026 – **פיצול לשלושה Repos (D‑16, Issue #50):**
  - ה־Repo `requests-management` שונה ל־`requests-management-docs` (Issues, Milestones, Board והיסטוריה נשמרו; GitHub מפנה מהשם הישן). התיקייה `.git` הועברה ל־`requests-management-docs\` עם קובץ זה ו־`docs/`; קבצי הקוד ו־`CLAUDE.md` הוסרו ממנו ב־Commit.
  - נוסף `README.md` בעברית ל־Repo התיעוד כנקודת כניסה לבודקים; `.gitignore` מינימלי.
  - `requests-management-be` (פרטי): ה־Solution, ‏`global.json`, ‏`src/`, ‏`tests/`, ‏`.github/` הועברו אליו; `.gitignore` של .NET ו־README קצר. Commit ראשון חדש – היסטוריית M0 נשארה ב־Repo התיעוד. build מקומי עובר.
  - `requests-management-fe` (פרטי): `.gitignore` של Node/Angular ו־README קצר; האפליקציה תיווצר בשורש ה־Repo ב־M7.
  - שני ה־Repos החדשים קושרו ל־Project Board #2.
  - עודכנו: D‑15, D‑16 (כאן וב־`DECISIONS.md`), סעיפים 4, 6, 7 (M0: ‏3.75 ש'), ‏`WORK_PLAN.md` (מבנה + מוסכמת Closes), ונתיבים/שמות Repo ב־Issues #2–#4, #17, #22, #31, #32, #44, #45, #47–#49.
- 22.10.2026 – **M1 הושלם (Issues #6–#9):**
  - **#6:** ‏Enums ‏`RequestStatus` (New=1..Completed=4) ו־`RequestPriority` (Low=1..High=3) מסוג byte בפרויקט DTO (משותפים ל־DTOs ול־Entities). Entities ו־`AppDbContext` הם **internal** ב־DAL – אכיפה של D‑04 בזמן קומפילציה. קונפיגורציה מפורשת לכל טבלה: אורכים לפי סעיף 6, ‏tinyint עם CHECK constraints, ‏`rowversion` כ־Concurrency Token, ‏FK להיסטוריה ללא Cascade. ‏`AssignedTo` הוא nullable (רק פניות New לא משויכות) ומכיל UserName. ‏Users: ‏`UserName` (ייחודי), ‏`DisplayName`; ‏PasswordHash יתווסף ב־M3 (Migration שני).
  - **#7:** Migration ‏`InitialCreate` עם כל האינדקסים מסעיף 6 + ‏`UX_Users_UserName`; לכל אינדקס הערה בקוד (`Configurations/`) על התרחיש שהוא משרת. ‏SQL שנוצר נבדק מול התוכנית.
  - **#8:** ‏Seeder דטרמיניסטי (Random seed ‏20261022, תאריך עוגן קבוע 2026‑10‑01) עם SqlBulkCopy בטרנזקציה אחת (`KeepIdentity`, `CheckConstraints`); פקודת `seed [--count N] [--reset]`; הגנה: ‏`--reset` רק למסד בשם `RequestsManagement` (נבדק מול מסד אחר על אותו מופע – נדחה). אתחול בעלייה לפי D‑17 עם `Database:MigrateOnStartup`/`SeedOnStartup`. היסטוריה עקבית עם D‑05 לכל פנייה שאינה New.
  - **#9:** אימות על המופע המקומי – 100,000 פניות, ‏179,178 שורות היסטוריה, 40 משתמשים, 400 ארגונים; סטטוס: ‏New 8.9%, ‏InProgress 17.0%, ‏Waiting 11.2%, ‏Completed 62.9%; עדיפות: 29.9/50.1/20.0%; ארגונים: 106–2,621 פניות (חציון 185.5). כל בדיקות העקביות = 0. הרצה שנייה עם `--reset` – סטטיסטיקות ו־Checksums זהים. פירוט מלא: [תגובה ב־#9](https://github.com/naomy55978/requests-management-docs/issues/9#issuecomment-6349549045).
  - מסלול הבודק (D‑17) נבדק מול LocalDB בלי user-secrets: Migration + Seed אוטומטי, השרת עלה; המסד ב־LocalDB נמחק לאחר הבדיקה. אתחול מול מסד עם נתונים – ה־Seed מדולג.
  - זמני Seed: ‏8.7–23.6 שנ' על המופע המקומי, ‏10.7 שנ' ב־LocalDB חם (הרצה ראשונה על LocalDB "קר" – 138 שנ').
  - אבטחה: ‏`Microsoft.Data.SqlClient` 6.1.7 (תלות של EF Core 10.0.13) מביא את `System.Security.Cryptography.Pkcs` 9.0.11 עם פגיעויות ידועות (GHSA-2fmv-rv2c-59x7, GHSA-846f-f764-76mx); הוצמדה גרסה 10.0.13 ב־DAL, עם הערה בקובץ הפרויקט.
  - שלושה Commits ב־BE ‏(סגירה אוטומטית של #6–#8 בהפניה מלאה – המוסכמה עובדת), ‏CI ירוק.
- 22.10.2026 – **M2 הושלם (Issues #10–#15):**
  - **החלטות שאושרו:** סדר ביצוע #10, #11, #12, #14, #13, #15 (תלויות ה־Issues עודכנו: #14 תלוי ב־#12, ‏#13 ב־#12 וב־#14); ‏`RequestDto` אחד לרשימה ולפרטים; סינון `organization` לפי התחלת שם (`LIKE 'x%'`, משתמש באינדקס); טווח תאריכים כ־`DateOnly` בימי UTC שלמים; ‏Enums כמחרוזות; ‏Swagger UI מעל ה־OpenAPI המובנה; ‏**D‑18** (מנגנון ולידציה אחד); ‏`assignedTo=unassigned` ← `AssignedTo IS NULL`.
  - **#10 – DTOs:** ‏`RequestFilter` (כללי הוולידציה מוצהרים עליו), ‏`RequestDto`, ‏`PagedResult<T>`, ‏`SummaryDto` ועוד, בפרויקט DTO (ללא תלויות).
  - **#11 – Repository:** ‏`IRequestRepository` ציבורי (DTOs בלבד), מימוש internal: שאילתת COUNT + שאילתת דף, ‏`AsNoTracking`, ‏Projection לעמודות הנדרשות, ‏`Id` כ־tie-breaker, ‏`LIKE` עם escape ל־`% _ [`, ‏CancellationToken לכל קריאה. תאריכים נקראים כ־UTC (`ValueConverter`, בלי שינוי סכמה – נבדק `has-pending-model-changes`).
  - **#12 – Service:** ‏`RequestService` (Scoped, עם Logging שלא כולל טקסט חופשי). **שינוי מהתכנון המקורי:** הוולידציה לא ב־Validator ב־BL אלא על ה־DTOs (D‑18) – ראו Issue #12 המעודכן.
  - **#14 – טיפול שגיאות:** ‏`GlobalExceptionHandler` + `AddProblemDetails` + `UseStatusCodePages`: כל שגיאה ב־`application/problem+json` עם `traceId`; ‏500 בלי `detail` מחוץ ל־Development. **תיקון שנמצא באימות:** ניתוק לקוח באמצע שאילתה יכול לזרוק `SqlException` ולא `OperationCanceledException` (ASP.NET מטפל רק בשני) – כעת כל חריגה אחרי ניתוק נרשמת כ־Information ומסתיימת ב־499, בלי Error. נבדק עם ~150 בקשות מבוטלות.
  - **#13 – Controller:** ‏`GET /api/requests`, ‏`GET /api/requests/{id}`, ‏`GET /api/requests/summary`; ‏Swagger UI ב־`/swagger` (Development בלבד), תיאורי XML ופרמטרים ב־camelCase. **#15 – Summary:** שלוש שאילתות GROUP BY (סטטוס, עדיפות, Top 10 ארגונים בפניות פתוחות).
  - **אימות (77 בדיקות, השוואה לשאילתות SQL ישירות על 100K הרשומות):** 20 תרחישי סינון/חיפוש (כולל תווי `% _ [ '` כתווים רגילים) – ספירות זהות; מיון ב־5 שדות × 2 כיוונים – אותו סדר כמו `ORDER BY` ב־SQL; דפדוף יציב (500 שורות ב־5 דפים בלי כפילויות); 19 קלטים לא חוקיים ← 400 באותו פורמט ובאותו Content-Type; 404/405 כ־ProblemDetails; ‏Summary זהה ל־SQL; ‏`version` = ה־RowVersion; הערך `unassigned` מתועד ב־OpenAPI. ‏Development/Production: ‏500 עם/בלי `detail`, ו־Swagger נעלם ב־Production. פירוט בתגובות ב־#11, #14, #15.
  - **זמני תגובה (מחשב הפיתוח, אחרי warm-up, מקצה לקצה):** רשימה ללא פילטר 21 ms; סטטוס+עדיפות 2 ms; ארגון 4 ms; מיון לפי title 121 ms; דף 1000 (OFFSET עמוק) 216 ms; ‏**חיפוש `LIKE '%x%'` 480 ms** (סריקה מלאה – ה־Bottleneck הצפוי, D‑12); ‏summary 114 ms (בסיס ל־Cache ב־M5).
  - **תוספת 3 (הודעת Seed):** ‏"Seeding 100,000 requests - this may take a few minutes on first run" נרשמת לפני ה־Seed (בעלייה וב־`seed`); נוסף ל־README של BE ולקריטריוני הקבלה של #45 (README ב־M9).
  - שבעה Commits ב־BE (סגירה אוטומטית של #10–#15), ‏CI ירוק.

## 9. שאלות פתוחות
- כיצד יקבלו הבודקים גישה **לשלושת** ה־Repos הפרטיים (שמות משתמש של הבודקים, או הפיכה לציבוריים בהגשה) – להחליט לפני M9.
- הרצה נוחה לבודקים מעבר ל־LocalDB (D‑17): ‏docker-compose שנבדק ב־CI, ו/או דמו חי בענן – להחליט ב־M9.
- יציבות מדידות M8 (ראו סעיף 10, לחץ זיכרון): האם להגדיר `min server memory` (למשל 2 GB) במופע המקומי `MSSQLSERVER`? דורש אישורך. חלופה: לסגור אפליקציות כבדות בזמן מדידה ולבצע warm-up.

## 10. סיכונים ובעיות ידועות
- חיפוש `LIKE '%x%'` אינו משתמש באינדקס – יימדד ויתועד (D‑12).
- מפתח ה־JWT: מפתח פיתוח בלבד ב־`appsettings.Development.json` (ב־Repo של ה־Backend), יתועד שאינו לייצור. אסור להכניס סודות אמיתיים לאף Repo – ייתכן שייפתחו לציבור בהגשה.
- בדיקות Integration תלויות ב־SQL Server מקומי פעיל.
- D‑17: בודק בלי LocalDB (למשל מחשב ללא Visual Studio/SQL Express) צריך לדרוס את מחרוזת ההתחברות – יתועד ב־README ב־M9. **הרצה ראשונה על LocalDB "קר" ארכה 138 שנ'** (הרצות חוזרות ~10–20 שנ'), ובזמן הזה ה־API עדיין לא מאזין. נוספה הודעת לוג לפני ה־Seed ("Seeding 100,000 requests - this may take a few minutes on first run"), ‏README של BE מציין זאת, וזה קריטריון קבלה ב־#45 (README הסופי ב־M9) – הבודק צריך לדעת למה לצפות.
- **חיפוש טקסט איטי יחסית:** ‏`search` ‏(`LIKE '%x%'`) נמדד ~480 ms ב־100K רשומות (סריקה מלאה), ומיון לפי עמודה בלי אינדקס מתאים (title, updatedAt) ~120 ms – ה־Bottleneck המתוכנן (D‑12). יטופל/יתועד ב־M8 (אינדקסים, ו־Full‑Text כהצעת שיפור).
- **לחץ זיכרון במחשב הפיתוח** (סעיף 4) מייצר "קפיאות" אקראיות של שאילתות ועלול לעוות מדידות M8. בבודק עם מחשב דל בזיכרון ייתכנו 500 על timeout של 30 שנ' בהרצה הראשונה.
- הודעות ה־Validation באנגלית וכוללות את שם המאפיין ("The field PageSize ..."), בעוד המפתח camelCase – ה־UI (M7) יציג הודעות משלו לפי המפתח.
- הצמדת `System.Security.Cryptography.Pkcs` 10.0.13 ב־DAL היא עקיפה זמנית – להסיר כש־EF Core/SqlClient יעדכנו את התלות (לבדוק בכל עדכון חבילות).
- שינוי ב־`SeedWordLists`/`SeedDataGenerator` משנה את הנתונים – מדידות M8 יש להשוות רק על אותה גרסת Seeder.
- Repos פרטיים: אם הבודקים לא יקבלו גישה **לכל שלושת** ה־Repos – לא יוכלו לבחון את ההגשה במלואה. חובה לטפל לפני ההגשה (D‑15, Issue #49).
- שלושה Repos: Commit ב־BE/FE שמפנה ל־Issue בלי הפניה מלאה (`#12` במקום `naomy55978/requests-management-docs#12`) יקושר ל־Repo הלא נכון ולא יסגור את ה־Issue.
- `CLAUDE.md` נמצא מחוץ ל־Repos: פתיחת Claude Code בתוך אחד ה־Repos (ולא ב־`<project-root>`) תטען רק את ההנחיות הגלובליות; גם clone חדש לא יכלול אותו.
- GitHub Actions ב־Repo פרטי צורך דקות מהמכסה החינמית (2,000 בחודש) – מספיק לפרויקט.

## 11. צעדים הבאים
1. (ידני, ‏10 שניות) ב־Project Board: להוסיף תצוגת Board (‏Layout → Board) – ה־CLI יוצר רק תצוגת Table.
2. M3 – ‏עדכון ו־Concurrency (Issues #16–#19) ב־`requests-management-be`, עם **Opus**. לפי CLAUDE.md: הצגת תוכנית M3 וקבלת אישור לפני ביצוע. נקודות מוכנות: ‏`RequestDto.Version` (base64) קיים; ה־Body של PATCH ושל Bulk יקבל Validation ב־DataAnnotations באותו מנגנון (D‑18, ‏`[EnumDataType]` לערך enum בודד); ‏`PasswordHash` ל־Users ב־Migration שני (כבר מתוכנן); שגיאות 404/409/422 כ־ProblemDetails באותו פורמט (D‑07); ה־`ValueConverter` של UTC כבר חל על `UpdatedAt`/`ChangedAt`; ב־`GlobalExceptionHandler` יש להוסיף מיפוי לחריגות עסק (או להחזיר ProblemDetails ישירות מה־Controller).
3. בכל משימה: להעביר את ה־Issue ל־In Progress/Done ב־Board ולסגור אותו מה־Commit – ב־BE/FE עם הפניה מלאה (`Closes naomy55978/requests-management-docs#n`), ב־Repo התיעוד `Closes #n`.
4. עדכון קובץ זה (ב־`requests-management-docs`) בסוף כל משימה, ב־Commit נפרד ב־Repo התיעוד.
