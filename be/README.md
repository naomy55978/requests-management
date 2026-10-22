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

הוראות הרצה מלאות (מסד נתונים, נתוני בדיקה, הרצת ה־API והבדיקות) יתווספו ב־M9.

> היסטוריית העבודה של M0 (הקמת ה־Solution) נשמרה ב־Repo של התיעוד, ממנו הקוד הועבר לכאן.
