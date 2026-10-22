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
- נתיב הפרויקט: `<project-root>` (שורש ה־Repo)
- `global.json` מקבע SDK ‏10.0.401 (מותקן גם SDK 9)

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
| D‑15 | Repo **פרטי** בשם `requests-management`; לפני ההגשה – הזמנת הבודקים כ־Collaborators (או הפיכה לציבורי) | בקשת המפתחת לשמור על פרטיות עד ההגשה | Repo ציבורי מההתחלה |

## 6. אפיון

### מבנה הפתרון
```
RequestsManagement.sln
src/
  RequestsManagement.API   Controllers, Middleware (ProblemDetails), Auth (JWT), Program.cs
  RequestsManagement.BL    IRequestService/RequestService, StatusTransitions, Validators, Cache
  RequestsManagement.DAL   Entities, AppDbContext, IRequestRepository/RequestRepository, Migrations, Seeder
  RequestsManagement.DTO   Request/Response DTOs, RequestFilter, PagedResult (ללא תלויות)
  requests-web             Angular 22
tests/
  RequestsManagement.Tests Unit/ + Integration/
docs/  DECISIONS.md, PERFORMANCE.md, API.md, WORK_PLAN.md
```
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
| `GET /api/requests` | page, pageSize (≤100), status[], priority[], organization, assignedTo, createdFrom, createdTo, search (Title+OrganizationName), sortBy (createdAt/updatedAt/priority/status/title), sortDir | 200/400 |
| `GET /api/requests/{id}` | פנייה בודדת | 200/404 |
| `GET /api/requests/summary` | Aggregations: ספירה לפי סטטוס ועדיפות; ארגונים מובילים בפניות פתוחות (Cache) | 200 |
| `PATCH /api/requests/{id}/status` | `{newStatus, version}` | 200/400/404/409/422 |
| `GET /api/requests/{id}/history` | היסטוריית שינויים | 200/404 |
| `POST /api/requests/bulk-status` | `{newStatus, items:[{id, version}]}` עד 100 | 200/400 |

### Angular
מסך רשימה (mat-table + mat-paginator + mat-sort, הכל בצד השרת), טופס סינון, חיפוש עם debounce ו־switchMap, כרטיסי summary, מצבי Loading/Empty/Error, עדכון סטטוס עם טיפול ב־409 (הודעה + רענון השורה), בחירה מרובה ל־Bulk עם הצגת התוצאה לכל פריט, חלון היסטוריה, מסך Login ו־Interceptor ל־JWT ולשגיאות. הפרדה: Components לתצוגה, Services ל־HTTP ולמצב.

## 7. תוכנית עבודה
| # | Milestone | תוצר | מאמץ | תלוי ב־ | מודל |
|---|---|---|---|---|---|
| M0 | הקמה ותכנון: Repo פרטי, ‏gh auth, ‏Solution + 5 פרויקטים + הפניות, ‏.gitignore, ‏Project Board, ‏Milestones, ‏Issues, שלד docs, ‏CI ל־build | Repo שעובר build ב־CI | 3 ש' | – | Opus |
| M1 | DB ונתונים: Entities, ‏DbContext, ‏Migration, אינדקסים, Seeder | DB עם 100K רשומות | 4 ש' | M0 | Opus לתכנון, Sonnet לקוד |
| M2 | API שליפה: סינון, מיון, דפדוף, Validation, ‏DTOs, ‏ProblemDetails, ‏Logging, ‏summary | GET פעיל + Swagger | 6 ש' | M1 | Sonnet |
| M3 | עדכון ו־Concurrency: מעברים, PATCH, ‏409, ‏Audit, ‏history, ‏JWT | עדכון בטוח | 5 ש' | M2 | Opus |
| M4 | Bulk | Endpoint + תיעוד | 3 ש' | M3 | Sonnet |
| M5 | Cache + Invalidation | Cache מתועד | 2 ש' | M3 | Sonnet |
| M6 | בדיקות: יחידה, Integration, ‏Concurrency, ‏Bulk, ‏Cache; ‏CI עם SQL Server | בדיקות ירוקות ב־CI | 5 ש' | M2–M5 | Sonnet |
| M7 | Angular – כל המסכים | UI מלא | 12 ש' | M2–M5 | Sonnet + Opus לסקירה |
| M8 | ביצועים: STATISTICS IO/TIME + Execution Plan לפני/אחרי לשתי פעולות, Bottleneck | PERFORMANCE.md | 3 ש' | M1–M2 | Opus |
| M9 | תיעוד והגשה: README בעברית, החלטות, מגבלה ושיפור, שימוש ב־AI, בדיקה מקצה לקצה | הגשה מלאה | 4 ש' | הכל | Sonnet + Opus לסקירה |

סה"כ כ־47 שעות. כל Issue כולל: תיאור, תוצר מצופה, הערכת מאמץ, תלויות, וסעיף מסמך הדרישות שהוא מכסה.

## 8. עבודה שהושלמה
- 22.10.2026 – קריאת הדרישות, אפיון, קבלת החלטות D‑01 עד D‑15, בדיקת סביבה, יצירת קובץ זה, התחברות ל־GitHub.
- 22.10.2026 – **M0 הושלם:**
  - Repo פרטי: https://github.com/naomy55978/requests-management
  - `RequestsManagement.sln` (פורמט `.sln` לפי האפיון, לא `.slnx`) עם API/BL/DAL/DTO תחת `src/` ו־Tests תחת `tests/` (תיקיות `Unit/`, `Integration/`), הפניות לפי סעיף 6, קוד דוגמה של התבניות הוסר. ‏`requests-web` ייווצר ב־M7.
  - `.gitignore` (‏.NET + Node/Angular); מסמך המבדק (PDF) מוחרג מה־Repo בכוונה.
  - CI: `.github/workflows/build.yml` – restore + build לפי `global.json`.
  - `docs/DECISIONS.md` (‏D‑01..D‑15 כלשונן), `docs/WORK_PLAN.md` (נוצר מאותו מקור כמו ה־Issues; כולל מטריצת מעקב דרישה ← Issues).
  - GitHub: ‏10 Milestones (M0–M9), ‏49 Issues בעברית (‏47 ש') עם תיאור, תוצר, קריטריוני קבלה, מאמץ, תלויות, סעיף במבדק ומודל מומלץ; תלויות גם כקשרי *blocked by* מובנים.
  - Labels: סוג עבודה (`backend`, `frontend`, `database`, `testing`, `docs`, `devops`, `planning`, `non-code`, `security`) + סעיף דרישה (`req-01..req-11`, `req-entity`, `req-submission`).
  - Project Board: https://github.com/users/naomy55978/projects/2 – מקושר ל־Repo, כל ה־Issues עם שדה `Estimate (h)`.

## 9. שאלות פתוחות
- כיצד יקבלו הבודקים גישה ל־Repo הפרטי (שמות משתמש של הבודקים, או הפיכה לציבורי בהגשה) – להחליט לפני M9.

## 10. סיכונים ובעיות ידועות
- חיפוש `LIKE '%x%'` אינו משתמש באינדקס – יימדד ויתועד (D‑12).
- מפתח ה־JWT: מפתח פיתוח בלבד ב־`appsettings.Development.json`, יתועד שאינו לייצור. אסור להכניס סודות אמיתיים ל־Repo הציבורי.
- בדיקות Integration תלויות ב־SQL Server מקומי פעיל.
- Repo פרטי: אם הבודקים לא יקבלו גישה – לא יוכלו לבחון את ההגשה. חובה לטפל לפני ההגשה (D‑15).
- GitHub Actions ב־Repo פרטי צורך דקות מהמכסה החינמית (2,000 בחודש) – מספיק לפרויקט.

## 11. צעדים הבאים
1. (ידני, ‏10 שניות) ב־Project Board: להוסיף תצוגת Board (‏Layout → Board) – ה־CLI יוצר רק תצוגת Table.
2. M1 – ‏DB ונתונים (Issues #6–#9), עם Opus לתכנון ו־Sonnet לקוד. לפי CLAUDE.md: הצגת תוכנית M1 וקבלת אישור לפני ביצוע.
3. בכל משימה: להעביר את ה־Issue ל־In Progress/Done ב־Board ולסגור אותו מה־Commit (`Closes #n`).
