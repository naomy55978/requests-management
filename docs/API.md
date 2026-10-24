# תיעוד ה־API

תיעוד מלא ואינטראקטיבי של כל ה־Endpoints (פרמטרים, מודלים וקודי תשובה) נמצא ב־Swagger UI של ה־API: `/swagger` (במצב Development). קובץ זה מרכז התנהגויות שדורשות הסבר והנמקה.
כל ה־Endpoints מלבד `POST /api/auth/login` דורשים `Authorization: Bearer <token>` (D‑10).

## עדכון סטטוס מרוכז (Bulk)

`POST /api/requests/bulk-status` – שינוי סטטוס של עד 100 פניות בקריאה אחת.

### למה Partial Success ולא All‑or‑Nothing (D‑08)
כל פנייה היא יחידה עצמאית: אם פנייה אחת השתנתה בינתיים אצל משתמש אחר (409) או שהמעבר אסור (422), אין סיבה שהמשתמש יאבד את העבודה על 99 הפניות האחרות. לכן:

- **כל פריט הוא עדכון נפרד בטרנזקציה משלו**, בדיוק באותו מסלול כמו `PATCH /api/requests/{id}/status` (עדכון מותנה בגרסה ובמעברים המותרים + שורת היסטוריה באותה טרנזקציה – D‑05, D‑06). אין לוגיקה כפולה: ה־Bulk והעדכון הבודד משתמשים באותה מתודה.
- **כשל בפריט אחד לא מבטל ולא עוצר את האחרים.**
- התשובה היא **200** גם אם כל הפריטים נכשלו; התוצאה לכל פריט מפורטת בגוף התשובה.
- **חלופה שנדחתה – All‑or‑Nothing:** טרנזקציה אחת לכל הבקשה. התנגשות אחת בין 100 פריטים הייתה מבטלת הכול, והלקוח היה צריך לנחש איזה פריט גרם לכך. בנוסף, טרנזקציה אחת הייתה נועלת עד 100 שורות לאורך זמן וגורמת ל־Deadlocks בין שתי קריאות Bulk חופפות.

### בקשה
```json
{
  "newStatus": "InProgress",
  "items": [
    { "id": 74634, "version": "AAAAAAAAB9E=" },
    { "id": 48521, "version": "AAAAAAAAB9I=" }
  ]
}
```

| שדה | כלל |
|---|---|
| `newStatus` | חובה; אחד מ־`New`, `InProgress`, `Waiting`, `Completed` (מחרוזת, או מספר 1–4). אותו סטטוס חדש לכל הפריטים |
| `items` | חובה; **1 עד 100** פריטים |
| `items[].id` | מספר חיובי; **כל מזהה פעם אחת לכל היותר** בבקשה |
| `items[].version` | חובה; ה־`version` (base64, 8 בתים) שהלקוח קרא מה־API |

אין שדה `changedBy`: **המשתמש שביצע את השינוי נלקח מהטוקן בלבד** (D‑10). שדה לא מוכר בגוף הבקשה (כולל `changedBy`) נדחה ב־400.

### תשובה – 200
```json
{
  "total": 4,
  "succeeded": 1,
  "failed": 3,
  "results": [
    { "id": 74634, "outcome": "Updated",
      "request": { "id": 74634, "title": "…", "organizationName": "…", "status": "InProgress",
                   "priority": "Medium", "assignedTo": "dana.cohen", "createdAt": "2026-03-02T08:14:00Z",
                   "updatedAt": "2026-10-23T09:30:12.845Z", "version": "AAAAAAAAB+A=" } },
    { "id": 999999999, "outcome": "NotFound" },
    { "id": 86830, "outcome": "Conflict",
      "currentStatus": "InProgress", "currentVersion": "AAAAAAAAB9w=", "currentUpdatedAt": "2026-10-23T09:29:58Z" },
    { "id": 20300, "outcome": "InvalidTransition",
      "currentStatus": "Completed", "currentVersion": "AAAAAAAAB9o=", "currentUpdatedAt": "2026-09-30T11:02:41Z",
      "allowedStatuses": [] }
  ]
}
```

- `total` – מספר הפריטים בבקשה; `succeeded` – כמה עודכנו; `failed` – כמה לא (`total − succeeded`).
- `results` – תוצאה אחת לכל פריט, **באותו סדר כמו בבקשה**. שדות ריקים אינם מופיעים.

| `outcome` | משמעות | שדות נוספים | מקביל ב־PATCH |
|---|---|---|---|
| `Updated` | הפנייה עודכנה והיסטוריה נרשמה | `request` – הפנייה המעודכנת, כולל `version` חדש | 200 |
| `NotFound` | אין פנייה עם המזהה | – | 404 |
| `Conflict` | הפנייה השתנתה אצל מישהו אחר מאז שנקראה (הגרסה שונה); אין שינוי. יש לטעון מחדש ולנסות עם הגרסה הנוכחית | `currentStatus`, `currentVersion`, `currentUpdatedAt` | 409 |
| `InvalidTransition` | הגרסה נכונה אבל המעבר אסור מהסטטוס הנוכחי (D‑05); אין שינוי | `currentStatus`, `currentVersion`, `currentUpdatedAt`, `allowedStatuses` | 422 |

אם הגרסה ישנה **וגם** המעבר אסור – התוצאה היא `Conflict` (כמו ב־PATCH, 409 קודם ל־422): קודם צריך נתונים עדכניים, ורק אז אפשר לשפוט את המעבר.
שליחה חוזרת של אותה בקשה אינה מעדכנת פעמיים: הפריטים שהצליחו כבר בגרסה חדשה, ולכן יחזרו כ־`Conflict`.

### שגיאות – 400 / 401 / 415
קלט לא תקין נדחה **כולו**, ושום פריט לא נשמר (`ValidationProblemDetails` עם כל הבעיות, מפתחות camelCase ו־`traceId`, D‑18):

| מקרה | מפתח השגיאה |
|---|---|
| רשימה ריקה, חסרה או `null` / יותר מ־100 פריטים | `items` |
| מזהה כפול (ההודעה מפרטת עד 10 מזהים) | `items` |
| `newStatus` חסר או לא חוקי | `newStatus` |
| `id` קטן מ־1 | `items[2].id` |
| `version` חסר או אינו base64 של 8 בתים | `items[2].version` |
| איבר `null` ברשימה | `items[2]` |
| שדה לא מוכר (למשל `changedBy`) | `$.changedBy` |

בלי טוקן – 401; גוף בלי `Content-Type: application/json` – 415.

### התנהגות בזמן ריצה
- הפריטים מעובדים **ברצף לפי סדר הבקשה** (ה־DbContext אינו בטוח ל־Threads, וכך כל רגע ננעלת שורה אחת בלבד – שתי קריאות Bulk חופפות לא יכולות ליצור Deadlock).
- אם הלקוח מתנתק באמצע, העיבוד נעצר; פריטים שכבר נשמרו נשארים (זו המשמעות של Partial Success).
- זמן: 100 פריטים בקריאה אחת נמדדו בכ־0.2 שנ' במחשב הפיתוח.
- Logging: שורת Information אחת לקריאה (משתמש, סטטוס יעד, ספירה לכל תוצאה וזמן). פריט שנכשל נרשם ב־Debug עם מזהה ותוצאה בלבד – בלי טוקן, גרסאות או גוף הבקשה.

### אימות
`node scripts/verify-bulk-status.js` ב־`requests-management-be` (ראו README שם): ולידציה, כל התוצאות בבקשה אחת והשפעתן על ה־DB וההיסטוריה, `ChangedBy` מהטוקן, 100 פריטים, וקריאות Bulk **במקביל** לבקשות PATCH בודדות על אותן פניות – לכל פנייה מנצח אחד בדיוק, ללא 5xx.

## סיכום (`GET /api/requests/summary`)

התשובה: `total`, ‏`byStatus` ו־`byPriority` (לכל ערך אפשרי – גם 0), ו־`topOrganizations`. התוצאה נשמרת ב־Cache של 60 שנ' ומתבטלת בכל שינוי סטטוס שנשמר (D‑11, ‏D‑20).

**סדר ה־`topOrganizations`:** עד 10 ארגונים, לפי מספר הפניות הפתוחות (כל סטטוס מלבד `Completed`) **בסדר יורד**, ובשוויון – **לפי שם הארגון בסדר עולה** (לפי ה־Collation של מסד הנתונים). הסדר דטרמיניסטי, כך שאותם נתונים תמיד מחזירים אותה רשימה באותו סדר.

### אימות
`node scripts/verify-summary-cache.js` ב־`requests-management-be` (ראו README שם) משווה את התשובה, כולל `topOrganizations` **לפי הסדר**, לחישוב ישיר ב־SQL.
