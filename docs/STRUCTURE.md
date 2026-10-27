# מבנה הקבצים – תפקיד כל תיקייה וכל קובץ

מסמך זה מתאר במשפט אחד את התפקיד של כל תיקייה ושל כל קובץ בשלושת ה־Repos: מה הוא ולמה הוא קיים. פרטי המימוש נמצאים בקוד ובמסמכים שאליהם הוא מפנה.

## איך שלושת ה־Repos קשורים זה לזה

- ‏[requests-management-be](https://github.com/naomy55978/requests-management-be) – ה־Backend: ‏REST API ב־ASP.NET Core שמחזיק את כל הלוגיקה, ניגש ל־SQL Server דרך EF Core, ומבצע בעצמו את כל הסינון, המיון, הדפדוף וה־Concurrency.
- ‏[requests-management-fe](https://github.com/naomy55978/requests-management-fe) – ה־Frontend: אפליקציית Angular בעברית שפונה ל־`/api` עם טוקן JWT; בפיתוח, שרת הפיתוח מעביר את `/api` ל־Backend (‏`proxy.conf.json`).
- ‏[requests-management-docs](https://github.com/naomy55978/requests-management-docs) – התכנון והתיעוד (ה־Repo הזה): נקודת הכניסה לבודקים, ההחלטות, חוזה ה־API ותוצאות המדידה; אין בו קוד.

## סדר קריאה מומלץ למי שחדש בפרויקט

1. ‏[README.md](../README.md) – מה המערכת, איך מריצים, ואיפה כל דרישה מכוסה.
2. ‏[PROJECT_SUMMARY.md](../PROJECT_SUMMARY.md) – הפרויקט במבט אחד, עם תרשימים.
3. ‏[docs/DECISIONS.md](DECISIONS.md) – ההחלטות והסיבות להן; להתחיל ב־D‑06 (Concurrency) וב־D‑08 (Bulk).
4. ‏`requests-management-be/src/RequestsManagement.API/Controllers/RequestsController.cs` – כל ה־Endpoints של הפניות במקום אחד (החוזה המלא: [API.md](API.md)).
5. ‏`requests-management-be/src/RequestsManagement.DAL/RequestRepository.cs` – השאילתות וה־`UPDATE` המותנה שאוכף את ה־Concurrency.
6. ‏`requests-management-be/src/RequestsManagement.BL/SummaryCache.cs` – ה־Cache של הסיכום וה־Invalidation שלו.
7. ‏`requests-management-be/tests/RequestsManagement.Tests/Integration/ConcurrencyTests.cs` – ההוכחה שאין Lost Update.
8. ‏`requests-management-fe/src/app/features/requests/requests-list.store.ts` – זרם ה־RxJS היחיד שמחבר את מסך הפניות לשרת.

## איך לקרוא את המסמך

כל Repo מחולק לכותרות לפי תיקיות (הנתיב המלא מתחילת ה־Repo), ותחת כל כותרת – הקבצים ותתי־התיקיות שלה; תיקייה מודגשת, וקובץ לא. כמה קבצים חולקים שורה אחת:
- רכיב Angular – שורה אחת לתיקיית הרכיב, שכוללת את `.ts`, ‏`.html`, ‏`.scss` ואת `.spec.ts`;
- קובץ קוד ב־Frontend וקובץ הבדיקה שלו (`+ .spec.ts`), שבודק בדיוק אותו קובץ;
- תיקייה מודגשת בלי פירוט מתחתיה – השורה מתארת את כל הקבצים שבתוכה (למשל `plans/` עם קבצי ה־`.sqlplan`);
- קבצי ה־Designer וה־Snapshot של EF Migrations.

ה־Backend לא מקבץ קבצי בדיקה: כל קובץ בדיקה בו מכסה תרחיש, ולא קובץ קוד אחד. תוכן שנוצר בבנייה ואינו ב־Git (‏`node_modules`, ‏`bin`, ‏`obj`, ‏`dist`, ‏`.angular`) אינו מתואר.

## requests-management-be

### ‏קבצי השורש

ה־Solution, הגרסאות שהבנייה נעולה עליהן ותיעוד ההרצה.

- ‏`.gitignore` – מוציא מ־Git תוצרי בנייה וקבצי עורכים (‏`bin`, ‏`obj`, ‏`.vs`), כדי שרק קוד מקור יישמר.
- ‏`README.md` – הוראות ההרצה של ה־Backend: מסד הנתונים, ה־API, הבדיקות, סקריפטי האימות ומדידת הביצועים.
- ‏`RequestsManagement.sln` – ה־Solution שמאגד את ארבעת הפרויקטים ואת פרויקט הבדיקות, כדי ש־`dotnet build` ו־`dotnet test` יעבדו מהשורש.
- ‏`global.json` – נועל את גרסת ה־‎.NET SDK, כדי שהבנייה תהיה זהה בכל מחשב וב־CI.
- ‏`dotnet-tools.json` – נועל את גרסת הכלי `dotnet-ef`, שבו נוצרות ה־Migrations.

### ‏`.github/`

הגדרות GitHub של ה־Repo.

- ‏**`workflows/`** – תהליכי ה־CI של GitHub Actions.
  - ‏`build.yml` – בונה ומריץ את כל הבדיקות בכל Push, מול SQL Server 2022 בקונטיינר זמני (D‑09).

### ‏`scripts/`

כלים שרצים מחוץ לאפליקציה ולבדיקות האוטומטיות.

- ‏`MeasureQueries.cs` – כלי מדידת השאילתות (logical reads, ‏Execution Plans, זמנים), המקור לכל התוצאות ב־[PERFORMANCE.md](PERFORMANCE.md) וב־`docs/performance/`.
- ‏**`dev/`** – כלי פיתוח אופציונליים, ששימשו לאימות כל שלב מול ה־API הרץ ו־100,000 פניות; ה־CI לא מריץ אותם.
  - ‏`README.md` – מסביר מה כל סקריפט בודק, איך מפעילים אותו, ושהבדיקות האוטומטיות הן מקור האמת.
  - ‏`ConcurrencyProof.cs` – מוכיח שאין Lost Update בעומס: ‏20 בקשות PATCH מקבילות לכל אחת מ־50 פניות.
  - ‏`verify-read-api.js` – משווה את השליפה (סינון, חיפוש, מיון, דפדוף) לשאילתות SQL ישירות, ובודק Validation ו־Summary.
  - ‏`verify-status-update.js` – בודק את עדכון הסטטוס הבודד: כל המעברים, קודי השגיאה וההיסטוריה.
  - ‏`verify-bulk-status.js` – בודק את העדכון המרוכז: ולידציה, כל סוגי התוצאות וריצה במקביל לעדכון בודד.
  - ‏`verify-summary-cache.js` – בודק את ה־Cache של הסיכום, כולל פקיעה אמיתית אחרי 60 שניות.

### ‏`src/`

ארבעת הפרויקטים של ה־Backend, אחד לכל שכבה (D‑03).

### ‏`src/RequestsManagement.API/`

שכבת ה־Web וה־Composition Root: ה־Endpoints, האימות, הטיפול בשגיאות והרכבת כל השכבות.

- ‏`Program.cs` – נקודת הכניסה: רושם את השירותים וה־Middleware, מאתחל את המסד ומפעיל את ה־API (או את מצב ה־`seed`).
- ‏`RequestsManagement.API.csproj` – קובץ הפרויקט: התלויות בחבילות ובשכבות האחרות.
- ‏`appsettings.json` – ההגדרות לכל סביבה: מחרוזת החיבור, ה־JWT, ‏Server-Timing ורמות ה־Logging.
- ‏`appsettings.Development.json` – הגדרות הפיתוח: הפעלת Migration, ‏Seed וחימום בעלייה, ומפתח JWT לפיתוח בלבד (D‑10, ‏D‑17).
- ‏**`Auth/`** – ההתחברות עם JWT.
  - ‏`JwtOptions.cs` – הגדרות ה־JWT מהקונפיגורציה (מנפיק, קהל, תוקף ומפתח).
  - ‏`JwtTokenService.cs` – מנפיק את הטוקן החתום, שהוא המקור היחיד לזהות המשתמש הפועל (D‑10).
  - ‏`BearerSecuritySchemeTransformer.cs` – מוסיף את ה־JWT למסמך ה־OpenAPI, כדי ש־Swagger UI יציג "Authorize" וישלח את הטוקן.
- ‏**`Commands/`** – מצבי הרצה מה־Command Line.
  - ‏`SeedCommand.cs` – מצב `seed`: יוצר (או מאפס) את נתוני הדמו ויוצא, בלי להפעיל את שרת ה־Web.
- ‏**`Controllers/`** – ה־Endpoints של ה־API.
  - ‏`AuthController.cs` – ה־Endpoint של ההתחברות למשתמשי הדמו, שמחזיר טוקן.
  - ‏`RequestsController.cs` – כל ה־Endpoints של הפניות: רשימה, פרטים, סיכום, עדכון סטטוס בודד ו־Bulk, והיסטוריה.
- ‏**`Middleware/`** – רכיבים שעוטפים כל בקשה.
  - ‏`GlobalExceptionHandler.cs` – רשת הביטחון האחרונה: חריגה שלא טופלה הופכת ל־`500` ב־ProblemDetails, בלי לחשוף פרטים פנימיים.
  - ‏`ServerTimingMiddleware.cs` – מוסיף את כותרת `Server-Timing` (זמן שרת, זמן DB, ‏Cache HIT/MISS), כבויה כברירת מחדל (D‑23, ‏D‑25).
- ‏**`Properties/`** – הגדרות ההפעלה המקומית.
  - ‏`launchSettings.json` – פרופילי `dotnet run` (‏http ו־https), הכתובת `http://localhost:5084` וסביבת Development.
- ‏**`Startup/`** – פעולות שרצות בעליית השרת.
  - ‏`StartupWarmUp.cs` – מחמם את המסד ואת ה־Cache של הסיכום לפני שה־API מתחיל להאזין, כדי שהבקשה הראשונה ללוח הבקרה תהיה מהירה (D‑48).
- ‏**`Validation/`** – פורמט שגיאות הקלט.
  - ‏`ValidationProblemResponse.cs` – בונה את תשובת ה־`400` עם שמות שדות פשוטים והודעות קריאות, גם כשגוף הבקשה אינו JSON תקין (D‑18).

### ‏`src/RequestsManagement.BL/`

הלוגיקה העסקית: חוקי מעברי הסטטוס, ה־Cache וההתחברות, בין ה־Controllers ל־Repository.

- ‏`RequestsManagement.BL.csproj` – קובץ הפרויקט, שתלוי רק ב־DAL וב־DTO.
- ‏`DependencyInjection.cs` – רושם את שירותי השכבה ב־DI, ונקרא רק מ־`Program.cs`.
- ‏`IRequestService.cs` – החוזה של הפעולות העסקיות על פניות, שה־Controller תלוי בו.
- ‏`RequestService.cs` – מממש את הפעולות על פניות: מפעיל את ה־Repository, אוכף את חוקי המעברים, מנקה את ה־Cache אחרי שינוי וכותב Log בלי מידע אישי.
- ‏`StatusTransitions.cs` – המקום היחיד שמגדיר אילו מעברי סטטוס מותרים (D‑05).
- ‏`SummaryCache.cs` – ה־Cache בזיכרון של הסיכום: ‏60 שניות, ‏Invalidation אחרי Commit ומונה "דור" נגד נתון ישן (D‑11, ‏D‑20).
- ‏`AuthService.cs` – מאמת שם משתמש וסיסמה מול ה־Hash השמור.

### ‏`src/RequestsManagement.DAL/`

שכבת הגישה לנתונים: ‏DbContext, ‏Entities, ‏Repositories, ‏Migrations ו־Seed, כך ש־SQL Server מוכר רק לשכבה הזו.

- ‏`RequestsManagement.DAL.csproj` – קובץ הפרויקט, עם EF Core והספק של SQL Server.
- ‏`AppDbContext.cs` – ה־DbContext של EF Core: הטבלאות, ההגדרות שלהן ומיפוי `UPPER` של SQL Server לשימוש ב־LINQ.
- ‏`DependencyInjection.cs` – רושם את ה־DbContext, ה־Repositories וה־Interceptor ב־DI, ונקרא רק מ־`Program.cs`.
- ‏`DatabaseOptions.cs` – הדגלים שקובעים אם בעלייה מריצים Migration, ‏Seed וחימום (D‑17, ‏D‑48).
- ‏`DatabaseInitialization.cs` – הכניסה לאתחול המסד מ־`Program.cs`: ‏Migrations ו־Seed בעלייה, ומצב ה־`seed`.
- ‏`DbTimingInterceptor.cs` – אוסף את זמן כל פקודת DB לכותרת `Server-Timing` (D‑25).
- ‏`IRequestRepository.cs` – החוזה של הגישה לפניות: שאילתות ו־`UPDATE` מותנה, שמחזירים DTOs בלבד (D‑04).
- ‏`RequestRepository.cs` – מימוש השליפה, העדכון הבודד וה־Bulk מול SQL Server, כולל ה־`UPDATE` המותנה על `RowVersion` שאוכף את ה־Concurrency ב־DB (D‑06).
- ‏`IUserRepository.cs` – החוזה של מה שההתחברות צריכה לדעת על משתמש.
- ‏`UserRepository.cs` – שולף משתמש לפי שם, לאימות הסיסמה.
- ‏**`Configurations/`** – מיפוי ה־Entities לטבלאות.
  - ‏`RequestConfiguration.cs` – מיפוי `Requests`: סוגי עמודות, ‏Check Constraints, ה־`rowversion` והאינדקסים שנבחרו במדידה.
  - ‏`RequestStatusHistoryConfiguration.cs` – מיפוי `RequestStatusHistory`: המפתח הזר והאינדקס שה־Endpoint של ההיסטוריה מחפש לפיו.
  - ‏`UserConfiguration.cs` – מיפוי `Users`, עם אינדקס ייחודי על שם המשתמש.
  - ‏`UtcDateTimeConverter.cs` – מסמן כל תאריך שנקרא מהמסד כ־UTC, כדי שהלקוח לא יפרש אותו כשעון מקומי.
- ‏**`Entities/`** – מחלקות הטבלאות, ‏internal כדי שלא יצאו מה־DAL (D‑04).
  - ‏`Request.cs` – פנייה.
  - ‏`RequestStatusHistory.cs` – שורת היסטוריה שנכתבת בכל שינוי סטטוס.
  - ‏`User.cs` – משתמש דמו שיכול להתחבר.
- ‏**`Migrations/`** – שינויי הסכמה של המסד, לפי סדר.
  - ‏`20261022192444_InitialCreate.cs` – יוצר את הטבלאות `Requests`, ‏`RequestStatusHistory` ו־`Users` ואת האינדקסים הראשונים (M1).
  - ‏`20261022205507_AddUserPasswordHash.cs` – מוסיף ל־`Users` את עמודת ה־Hash של הסיסמה, להתחברות.
  - ‏`20261023094514_TuneIndexes.cs` – מחליף את אינדקסי M1 בשבעת האינדקסים שנבחרו במדידה (D‑24).
  - ‏`*.Designer.cs`, ‏`AppDbContextModelSnapshot.cs` – קבצים ש־EF Core מייצר לכל Migration ולמצב המודל הנוכחי, ומשמשים אותו לחישוב ה־Migration הבא; לא נערכים ידנית.
- ‏**`Seeding/`** – נתוני הדמו.
  - ‏`DatabaseSeeder.cs` – כותב 100,000 פניות ואת משתמשי הדמו ב־SqlBulkCopy, ומסרב לאפס מסד שאינו מסד הדמו (D‑13).
  - ‏`SeedDataGenerator.cs` – מייצר נתונים דטרמיניסטיים, כדי שאותה כמות תיתן תמיד אותן שורות ומדידות יהיו ברות השוואה.
  - ‏`SeedWordLists.cs` – רשימות המילים לכותרות ולשמות הארגונים, בעברית ובאנגלית (D‑33).

### ‏`src/RequestsManagement.DTO/`

המודלים של הבקשות והתשובות וכללי הוולידציה שלהם, בלי תלויות, כדי שכל השכבות יוכלו להשתמש בהם.

- ‏`RequestsManagement.DTO.csproj` – קובץ הפרויקט, בלי תלויות בפרויקטים אחרים.
- ‏`Auth.cs` – גוף בקשת ההתחברות והתשובה שלה (טוקן ותוקף).
- ‏`RequestFilter.cs` – פרמטרי הרשימה (דפדוף, סינון, חיפוש, מיון) וכללי הוולידציה שלהם (D‑18).
- ‏`PagedResult.cs` – דף של תוצאות יחד עם הספירה הכוללת, למספור העמודים.
- ‏`RequestDto.cs` – פנייה כפי שהיא מוצגת ברשימה ובפרטים, כולל הגרסה ל־Concurrency.
- ‏`StatusUpdate.cs` – גוף עדכון הסטטוס הבודד ותוצאת העדכון, בלי המשתמש הפועל, שנלקח מהטוקן (D‑10).
- ‏`BulkStatusUpdate.cs` – גוף העדכון המרוכז (עד 100 פניות) והתשובה עם תוצאה לכל פריט (D‑08).
- ‏`StatusHistoryDto.cs` – שורה אחת בהיסטוריית הסטטוס של פנייה.
- ‏`SummaryDto.cs` – הנתונים המסכמים של לוח הבקרה.
- ‏**`Diagnostics/`** – טיפוסי אבחון שעוברים בין השכבות.
  - ‏`RequestTimings.cs` – המדידות של בקשת HTTP אחת (זמן DB ותוצאת ה־Cache), שכל שכבה תורמת להן לכותרת `Server-Timing`.
- ‏**`Enums/`** – הערכים הסגורים של המודל.
  - ‏`RequestStatus.cs` – סטטוס פנייה, שמתחיל ב־1 כדי שערך ברירת המחדל לא יהיה סטטוס תקין.
  - ‏`RequestPriority.cs` – עדיפות פנייה, בסדר מספרי שתואם את הסדר העסקי לצורך מיון.
  - ‏`RequestSortField.cs` – השדות שמותר למיין לפיהם, כדי שהלקוח לא ימיין לפי עמודה שרירותית.
  - ‏`SortDirection.cs` – כיוון המיון.

### ‏`tests/`

פרויקט הבדיקות האוטומטיות.

### ‏`tests/RequestsManagement.Tests/`

בדיקות xUnit: יחידה, ו־Integration דרך HTTP מול SQL Server אמיתי במסד זמני (D‑21).

- ‏`RequestsManagement.Tests.csproj` – קובץ פרויקט הבדיקות והתלויות שלו.
- ‏`AssemblyAttributes.cs` – מבטל הרצה מקבילית של מחלקות בדיקה, כי הן חולקות מסד, API ו־Cache אחד.
- ‏**`Unit/`** – בדיקות יחידה, בלי מסד נתונים.
  - ‏`StatusTransitionsTests.cs` – בודק את מטריצת מעברי הסטטוס המותרים והאסורים.
  - ‏`ValidationTests.cs` – בודק את כללי הוולידציה שעל ה־DTOs.
  - ‏`SummaryCacheTests.cs` – בודק את ה־Cache עצמו: שמירה, פקיעה, ‏Invalidation ומונה ה"דור".
  - ‏`RequestServiceCacheTests.cs` – בודק מתי שינוי סטטוס מנקה את ה־Cache ומתי לא, מול Repository מזויף.
  - ‏`SeedDataTests.cs` – בודק שנתוני הדמו נשארים בגבולות העמודות ובכללי רשימות המילים.
  - ‏`ServerTimingFormatTests.cs` – בודק שכותרת `Server-Timing` עומדת בתחביר W3C בכל הגדרת Culture.
  - ‏`StartupWarmUpTests.cs` – בודק שהחימום רץ רק כשהוא מופעל, ושה־API עולה גם כשהחימום נכשל.
- ‏**`Integration/`** – בדיקות דרך ה־API האמיתי מול SQL Server.
  - ‏`AuthenticationTests.cs` – בודק שכל Endpoint מלבד ההתחברות דורש טוקן תקין.
  - ‏`ReadRequestsTests.cs` – בודק סינון, חיפוש, מיון ודפדוף מול תוצאה שמחושבת מהנתונים ("Oracle").
  - ‏`UpdateStatusTests.cs` – בודק את עדכון הסטטוס הבודד ואת ההיסטוריה, גם בתשובה וגם במה שנשמר במסד.
  - ‏`ConcurrencyTests.cs` – מוכיח ש־20 עדכונים מקבילים עם אותה גרסה מסתיימים בהצלחה אחת, ‏19 תשובות `409` ושורת היסטוריה אחת.
  - ‏`BulkStatusTests.cs` – בודק את העדכון המרוכז: ‏Partial Success ועדכון נפרד לכל פריט.
  - ‏`SummaryTests.cs` – בודק שהסיכום תואם את המסד, ששינוי נראה מיד, ושכשל לא מנקה את ה־Cache.
  - ‏`ValidationErrorTests.cs` – בודק את פורמט ה־`400` כשגוף הבקשה אינו קריא.
  - ‏`ServerTimingTests.cs` – בודק את כותרת `Server-Timing` בתשובות כשהיא מופעלת.
  - ‏**`Infrastructure/`** – התשתית המשותפת לבדיקות ה־Integration.
    - ‏`SqlServerTestDatabase.cs` – יוצר מסד זמני לריצה אחת ומוחק אותו בסופה, בלי לגעת במסדים אחרים (D‑09).
    - ‏`ApiFactory.cs` – מריץ את ה־API האמיתי בזיכרון מול המסד הזמני, ומחליף רק הגדרות.
    - ‏`ApiFixture.cs` – מה שכל הבדיקות חולקות: המסד, ה־API וטוקן לכל משתמש דמו.
    - ‏`TestData.cs` – הנתונים הקבועים שנכתבים למסד ומשמשים גם כ־Oracle לתוצאה הצפויה.

## requests-management-fe

### ‏קבצי השורש

הגדרות הפרויקט, הבנייה, הבדיקות וכללי הקוד.

- ‏`.editorconfig` – כללי עריכה אחידים (הזחה, קידוד, סוף שורה) לכל עורך.
- ‏`.gitignore` – מוציא מ־Git את `node_modules`, תוצרי הבנייה וקבצי עורכים.
- ‏`.nvmrc` – גרסת Node.js של הפרויקט (24), כמו ב־CI.
- ‏`.prettierrc` – כללי העיצוב האוטומטי של הקוד ושל תבניות ה־HTML.
- ‏`README.md` – הוראות ההרצה של ה־Frontend: התקנה, התחברות, המסכים, הבדיקות ומבנה הקוד.
- ‏`angular.json` – הגדרות ה־Angular CLI: בנייה, שרת פיתוח עם Proxy, בדיקות ו־Lint.
- ‏`eslint.config.js` – כללי ה־Lint, כולל האכיפה שכל רכיב מחולק לקבצי `.ts`, ‏`.html` ו־`.scss` נפרדים.
- ‏`package.json` – התלויות והפקודות (`start`, ‏`build`, ‏`test`, ‏`lint`).
- ‏`package-lock.json` – נועל את הגרסאות המדויקות, כדי ש־`npm ci` יתקין בדיוק את מה שנבדק.
- ‏`proxy.conf.json` – מעביר את `/api` משרת הפיתוח ל־Backend, כדי שלא יידרש CORS.
- ‏`tsconfig.json` – הגדרות TypeScript וקומפיילר Angular המשותפות לאפליקציה ולבדיקות.
- ‏`tsconfig.app.json` – הגדרות TypeScript לבניית האפליקציה.
- ‏`tsconfig.spec.json` – הגדרות TypeScript לבדיקות.

### ‏`.github/`

הגדרות GitHub של ה־Repo.

- ‏**`workflows/`** – תהליכי ה־CI של GitHub Actions.
  - ‏`ci.yml` – מריץ בכל Push את ה־Lint, את הבדיקות ואת בניית ה־Production.

### ‏`public/`

קבצים סטטיים שמועתקים לבנייה כמו שהם.

- ‏`favicon.ico` – האייקון של לשונית הדפדפן.

### ‏`src/`

קוד המקור של האפליקציה.

- ‏`index.html` – דף ה־HTML היחיד, בכיוון RTL ובעברית, שהאפליקציה נטענת לתוכו.
- ‏`main.ts` – נקודת הכניסה שמפעילה את האפליקציה.
- ‏`styles.scss` – העיצוב הגלובלי וערכת הנושא של Angular Material.
- ‏**`environments/`** – הגדרות לפי סביבה.
  - ‏`environment.ts` – הגדרות ה־Production: כתובת ה־API היחסית `/api` וממשק הביצועים כבוי.
  - ‏`environment.development.ts` – הגדרות הפיתוח, שמחליפות את `environment.ts` ב־`ng serve`.

### ‏`src/app/`

האפליקציה עצמה: רכיב השורש, ההגדרות, הניתוב, ושלוש תיקיות התוכן `core/`, ‏`features/` ו־`shared/`.

- ‏`app.component.ts` (+ `.html`, ‏`.scss`, ‏`.spec.ts`) – רכיב השורש: סרגל עליון עם ניווט והתנתקות, אזור המסכים ופאנל הביצועים האופציונלי.
- ‏`app.config.ts` – הגדרות האפליקציה: ניתוב, HTTP עם ה־Interceptors, לוקאל עברי ושאר ה־Providers.
- ‏`app.routes.ts` (+ `.spec.ts`) – הנתיבים: התחברות, לוח בקרה ופניות, עם ה־Guard ועם לוח הבקרה כברירת מחדל (D‑43).

### ‏`src/app/core/`

שירותים ולוגיקה שאינם מסך: גישה ל־API, התחברות, טקסטים בעברית, מדידת ביצועים וניתוב.

- ‏**`api/`** – הגישה ל־API והמודלים שלו.
  - ‏`api.models.ts` – הטיפוסים שתואמים את ה־DTOs של ה־Backend.
  - ‏`problem-details.ts` – הטיפוס של גוף השגיאה (ProblemDetails) שה־API מחזיר.
  - ‏`requests-api.service.ts` (+ `.spec.ts`) – קריאות ה־HTTP ל־`/api/requests`, בלי מצב ובלי לוגיקת תצוגה.
  - ‏`error-messages.ts` (+ `.spec.ts`) – בוחר הודעת שגיאה בעברית לפי קוד התשובה והשדות השגויים, כי טקסטי השרת באנגלית.
  - ‏`status-transitions.ts` (+ `.spec.ts`) – עותק של מטריצת המעברים, רק כדי להחליט אילו אפשרויות להציג בתפריט; השרת הוא הסמכות (D‑35).
- ‏**`auth/`** – ההתחברות והסשן.
  - ‏`auth.service.ts` (+ `.spec.ts`) – מחזיק את הסשן (הטוקן ומי המשתמש) ב־`sessionStorage` ובודק את תוקפו (D‑26).
  - ‏`auth.guard.ts` (+ `.spec.ts`) – מכניס למסכים רק משתמש מחובר, ושולח אחר למסך ההתחברות עם כתובת חזרה.
  - ‏`auth.interceptor.ts` (+ `.spec.ts`) – מוסיף את הטוקן לכל קריאה, ובתשובת `401` מנתק ומעביר למסך ההתחברות.
  - ‏`safe-return-url.ts` (+ `.spec.ts`) – מקבל אחרי ההתחברות רק כתובת חזרה פנימית, כדי שקישור מזויף עם `returnUrl` לא יוביל לאתר חיצוני (Open Redirect).
  - ‏`auth.test-helpers.ts` – סשן מזויף לבדיקות, כולל סשן שתוקפו פג.
- ‏**`i18n/`** – טקסטים בעברית.
  - ‏`labels.ts` – התרגום לעברית של ערכי הסטטוס והעדיפות שה־API שולח באנגלית, במקום אחד.
  - ‏`hebrew-paginator-intl.ts` (+ `.spec.ts`) – הטקסטים בעברית של רכיב הדפדוף, ש־Material מספק באנגלית בלבד.
- ‏**`icons/`** – האייקונים.
  - ‏`app-icons.ts` – האייקונים שהאפליקציה משתמשת בהם, כ־SVG מוטמע, כדי שתעבוד בלי גישה ל־CDN.
- ‏**`perf/`** – ממשק הביצועים האופציונלי (D‑23).
  - ‏`show-performance.ts` – המתג שקובע אם ממשק הביצועים פעיל; כבוי כברירת מחדל.
  - ‏`timing.interceptor.ts` (+ `.spec.ts`) – מודד כל קריאה ל־API וקורא את כותרת `Server-Timing` מהתשובה.
  - ‏`server-timing.ts` (+ `.spec.ts`) – מפענח את כותרת `Server-Timing` לזמן שרת, זמן DB ותוצאת Cache.
  - ‏`performance-log.service.ts` (+ `.spec.ts`) – שומר את המדידות האחרונות, שמהן מוצגים התגים והפאנל.
  - ‏`format-ms.ts` (+ `.spec.ts`) – מציג משך זמן במילישניות בפורמט אחיד.
- ‏**`routing/`** – התנהגות הניתוב.
  - ‏`app-title-strategy.ts` (+ `.spec.ts`) – כותרת לשונית הדפדפן בצורה "‏<מסך> · ניהול פניות".

### ‏`src/app/features/`

המסכים של האפליקציה, תיקייה לכל מסך.

### ‏`src/app/features/dashboard/`

לוח הבקרה – המסך הראשון אחרי ההתחברות (D‑43).

- ‏**`dashboard-page/`** – דף לוח הבקרה, שטוען את הסיכום בפתיחה ומציע כפתור "רענן" (D‑38).
- ‏**`summary-cards/`** – כרטיסי הסיכום: סך הכול, לפי סטטוס ועדיפות, והארגונים המובילים, עם מצבי טעינה ושגיאה משלהם.
- ‏`summary.store.ts` (+ `.spec.ts`) – המצב של הסיכום והבקשה שלו, כך שסיכום איטי או כושל לא חוסם דבר אחר.
- ‏`summary.test-helpers.ts` – סיכום מזויף וקריאה שעונים עליה ידנית, לבדיקות לוח הבקרה.

### ‏`src/app/features/login/`

מסך ההתחברות.

- ‏`login.component.ts` (+ `.html`, ‏`.scss`, ‏`.spec.ts`) – טופס ההתחברות, שאחרי הצלחה חוזר לכתובת המבוקשת או ללוח הבקרה.

### ‏`src/app/features/requests/`

מסך הפניות: טבלה, סינון, חיפוש, עדכון סטטוס, ‏Bulk והיסטוריה.

- ‏`requests-list.store.ts` (+ `.spec.ts`) – המצב של מסך הפניות: זרם RxJS אחד שמקפל כל שינוי לשאילתה, עם `debounceTime` ו־`switchMap` (D‑27, ‏D‑28).
- ‏`requests-list.store.test-helpers.ts` – תשתית לבדיקות ה־Store: API מזויף שעונים לו ידנית.
- ‏`request-filters.ts` (+ `.spec.ts`) – מבנה טופס הסינון והמרתו לפרמטרי השאילתה, עם אותן מגבלות כמו ה־API.
- ‏`date-only.ts` (+ `.spec.ts`) – ממיר תאריך שנבחר ל־`yyyy-MM-dd` בלי המרה ל־UTC, כדי שהיום לא יזוז אחורה.
- ‏`status-update-failure.ts` (+ `.spec.ts`) – מתרגם כשל בעדכון סטטוס (‏`409`, ‏`422` ואחרים) למצב הנוכחי של הפנייה ולהודעה בעברית.
- ‏`bulk-result.ts` (+ `.spec.ts`) – הופך את תשובת ה־Bulk לשורות לתצוגה ולסיכום של מה הצליח ומה לא.
- ‏**`requests-page/`** – דף הפניות, שמרכיב את החלקים ומחבר אותם ל־Store.
- ‏**`requests-filters/`** – טופס הסינון והחיפוש, שאוסף את מה שהמשתמש הזין ומדווח עליו ל־Store.
- ‏**`requests-table/`** – טבלת הפניות: מיון, בחירה ל־Bulk, שינוי סטטוס ופתיחת היסטוריה בשורה; מציגה בלבד ומעבירה את האירועים לדף.
- ‏**`bulk-bar/`** – הסרגל שמופיע מעל הטבלה כשנבחרו פניות: כמה נבחרו, הסטטוס החדש והכפתורים.
- ‏**`bulk-result-dialog/`** – חלון התוצאה של Bulk, פריט אחר פריט (Partial Success).
- ‏**`confirm-complete-dialog/`** – חלון אישור לפני מעבר ל"הושלמה", כי זה מצב סופי שאין ממנו חזרה (D‑05).
- ‏**`request-history-dialog/`** – חלון היסטוריית הסטטוס של פנייה: מאיזה סטטוס לאיזה, מתי ומי.

### ‏`src/app/shared/`

רכיבי תצוגה קטנים שמשמשים כמה מסכים, ומציגים רק את מה שהם מקבלים.

- ‏**`status-chip/`** – תג צבעוני של סטטוס, שהטקסט בעברית שבו תמיד אומר את הסטטוס.
- ‏**`priority-chip/`** – תג צבעוני של עדיפות, שהטקסט בעברית שבו תמיד אומר את העדיפות.
- ‏**`state-message/`** – הודעת מצב ריק או שגיאה, עם כפתור פעולה אופציונלי ("נסה שוב").
- ‏**`timing-badge/`** – תג קטן עם משך הטעינה ותוצאת ה־Cache, ופירוט ב־Tooltip (ממשק הביצועים).
- ‏**`performance-panel/`** – פאנל "ביצועים" עם הבקשות האחרונות וזמניהן (ממשק הביצועים).

## requests-management-docs

### ‏קבצי השורש

נקודת הכניסה לבודקים.

- ‏`.gitignore` – מוציא מ־Git קבצי עורכים ומערכת הפעלה.
- ‏`README.md` – נקודת הכניסה: מה המערכת, איך מריצים ובודקים, ההחלטות המרכזיות ואיפה כל דרישה מכוסה.
- ‏`PROJECT_SUMMARY.md` – הפרויקט כולו במבט אחד, עם תרשימים ומפת מסמכים.

### ‏`docs/`

המסמכים המפורטים.

- ‏`DECISIONS.md` – כל ההחלטות (D‑01 עד D‑48), עם הסיבה והחלופות, והמגבלות הידועות.
- ‏`API.md` – חוזה ה־API: התנהגויות שדורשות הסבר, ‏Bulk וקודי השגיאה.
- ‏`PERFORMANCE.md` – המדידה, האינדקסים, ה־Execution Plans וה־Bottleneck.
- ‏`CACHE.md` – ה־Cache של הסיכום, ה־Invalidation ומה נדרש בריבוי מופעי שרת.
- ‏`WORK_PLAN.md` – תוכנית העבודה: ‏Milestones, משימות, הערכות מאמץ ומיפוי דרישות למשימות.
- ‏`SUBMISSION_CHECK.md` – הבדיקה מקצה לקצה מ־clone נקי, כמו שבודק יעבור.
- ‏`STRUCTURE.md` – מסמך זה: התפקיד של כל תיקייה וכל קובץ בשלושת ה־Repos.

### ‏`docs/performance/`

התוצאות הגולמיות של המדידות, כפי ש־`MeasureQueries.cs` כתב אותן; הניתוח – ב־[PERFORMANCE.md](PERFORMANCE.md). בכל תיקיית ריצה: ‏`results.md` (טבלאות ועצי Plans), ‏`results.json` (הנתונים הגולמיים להשוואה), ‏`compare-with-*.md` (השוואה לריצה אחרת) ו־`plans/` (ה־Execution Plans, לפתיחה ב־SSMS).

- ‏`README.md` – מדריך לתיקייה: איפה המספרים הסופיים ומה בכל תת־תיקייה.
- ‏**`final/`** – המצב הסופי (האינדקסים וה־SQL של היום, ‏Seeder v1), שכל ההשוואות "לפני ← אחרי" מתייחסות אליו.
  - ‏`results.md`, ‏`results.json`, ‏`compare-with-before.md`, ‏`compare-with-after-indexes.md` – תוצאות המצב הסופי והשוואתו לבסיס ולמצב עם האינדקסים בלבד.
  - ‏**`plans/`** – ה־Execution Plans בפועל של השאילתות Q1–Q9 ושל העדכון W1 במצב הסופי.
- ‏**`seed-v2-hebrew/`** – אותו מצב סופי על נתוני הדמו בעברית שבהגשה (Seeder v2).
  - ‏`results.md`, ‏`results.json`, ‏`compare-with-seed-v1-english.md` – תוצאות המצב הסופי על הנתונים בעברית והשוואתן לנתונים באנגלית.
  - ‏`gate-g3.md` – שער הקבלה G3: הבדיקה שהחלפת הנתונים לא פגעה בביצועים.
  - ‏**`plans/`** – ה־Execution Plans של Q1–Q9 ו־W1 על הנתונים בעברית.
- ‏**`before/`** – הבסיס להשוואה: אינדקסי M1 וה־SQL של M2, לפני עבודת הביצועים.
  - ‏`results.md`, ‏`results.json` – תוצאות הבסיס.
  - ‏**`plans/`** – ה־Execution Plans של Q1–Q9 ו־W1 בבסיס.
- ‏**`after-indexes/`** – אינדקסי M8 עם ה־SQL של M2, כדי להפריד את השפעת האינדקסים לבדם.
  - ‏`results.md`, ‏`results.json`, ‏`compare-with-before.md` – תוצאות האינדקסים בלבד והשוואתן לבסיס.
  - ‏**`plans/`** – ה־Execution Plans של Q1–Q9 ו־W1 עם האינדקסים החדשים וה־SQL הישן.
- ‏**`alternatives/`** – חלופות השאילתה שנבחנו בניתוח ה־Bottleneck (A1–A6).
  - ‏`results.md`, ‏`results.json` – תוצאות החלופות.
  - ‏**`plans/`** – ה־Execution Plans של החלופות A1–A6.
- ‏**`archive/`** – מדידות ביניים שנשמרו כתיעוד; מסקנותיהן כבר מסוכמות ב־PERFORMANCE.md.

### ‏`docs/performance/archive/`

מדידות הביניים, שאין צורך לפתוח כדי לקרוא את התוצאות הסופיות.

- ‏**`before-fragmented/`** – מדידת הבסיס הראשונה, על אינדקסים מפוצלים אחרי ה־Seed (ממצא מתודולוגי, PERFORMANCE.md §3).
  - ‏`results.md`, ‏`results.json` – תוצאות המדידה על האינדקסים המפוצלים.
  - ‏**`plans/`** – ה־Execution Plans של Q1–Q9 ו־W1 על האינדקסים המפוצלים.
- ‏**`experiments/`** – ‏13 ניסויי אינדקסים, תיקייה לכל ניסוי (`without-*` – כיבוי אינדקס קיים, ‏`with-*`, ‏`narrow-SPC-*`, ‏`AC-*`, ‏`final-OrgCreatedAt` – מועמדים), כל אחת עם `results.md`, ‏`results.json` והשוואה, בלי Plans (PERFORMANCE.md §5).
- ‏**`seed-v1-english/`** – מדידה חוזרת של המצב הסופי לפני החלפת הנתונים לעברית, הבסיס להשוואה v1 ← v2.
  - ‏`results.md`, ‏`results.json`, ‏`compare-with-final.md` – תוצאות המדידה החוזרת והשוואתן למצב הסופי.
  - ‏**`plans/`** – ה־Execution Plans של Q1–Q9 ו־W1 על הנתונים באנגלית.
