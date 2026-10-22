# החלטות טכנולוגיות

מסמך זה מרכז את ההחלטות המשמעותיות בפרויקט: מה הוחלט, למה, ואילו חלופות נשקלו.
ההחלטות יעודכנו לאורך המימוש (Issue #46), כולל מגבלה ידועה ודבר שניתן לשפר.

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
