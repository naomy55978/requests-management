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

### הוכחת Concurrency

סקריפט שמוכיח שאין Lost Update: לכל אחת מ־50 פניות נשלחות 20 בקשות שינוי סטטוס **במקביל** עם אותה גרסה, משני משתמשים. מצופה: בדיוק `200` אחד ו־19 תשובות `409`, ושורת היסטוריה אחת בלבד – של המנצח. כשה־API רץ:

```
dotnet run scripts/ConcurrencyProof.cs
```

הוראות הרצה מלאות (כולל הבדיקות) יתווספו ב־M9.

> היסטוריית העבודה של M0 (הקמת ה־Solution) נשמרה ב־Repo של התיעוד, ממנו הקוד הועבר לכאן.
