# ביצועים – מדידה, אינדקסים ו־Bottleneck

> M8 (ביצועים), Issues [#42](https://github.com/naomy55978/requests-management/issues/42)–[#44](https://github.com/naomy55978/requests-management/issues/44). החלטה: D‑24 (אינדקסים ושאילתות) ב־[DECISIONS.md](DECISIONS.md).
> כל המספרים נמדדו על 100,000 פניות ו־179,178 שורות היסטוריה (ה־Seed הדטרמיניסטי, D‑13), בכלי שנמצא ב־Repo של ה־Backend וניתן להריץ שוב: `scripts/MeasureQueries.cs`.
>
> **גרסאות Seeder:** כל המדידות במסמך (סעיפים 1–8 ונספח א׳) נעשו על **Seeder v1** – כותרות וארגונים באנגלית. ב־D‑33 הנתונים הוחלפו ל־**v2** (כותרות בעברית, ארגונים בעברית ובאנגלית), ופרק 9 מציג את המדידה מחדש והשוואה. מספרי v1 לא שונו – הם נשארים נכונים לגרסה שעליה נמדדו.

## 1. תקציר: שלוש פעולות מרכזיות

המדד הראשי הוא **logical reads** (מספר דפי 8KB שהשאילתה קראה) ו**צורת ה־Plan**. הם לא תלויים בעומס או בזיכרון של המחשב. הזמנים הם מדד משני (חציון של 10 הרצות חמות, ראו סעיף 3).

| פעולה | לפני (M1/M2) | אחרי (M8) | מה השתנה |
|---|---|---|---|
| **רשימה ראשית – סינון משולב** (Q1: ‏`status=InProgress,Waiting` + ‏`priority=High`, מיון ברירת מחדל, דף 1) | COUNT: ‏**697** reads; דף: 779 | COUNT: ‏**76**; דף: 839 | האינדקס `(Status, Priority, CreatedAt)` צר ובלי INCLUDE – ה־COUNT קורא פי 9 פחות דפים. 0–1 ms בשני המקרים |
| **חיפוש חופשי** (Q6: ‏`search=bonus`, ‏`LIKE '%x%'`, COUNT) | 2,427 reads, ‏**397 ms** | 2,460 reads, ‏**52 ms** | עדיין סריקה מלאה, אבל ההשוואה בינארית אחרי `UPPER` (סעיף 6.2) – **פי 7.6 מהר יותר** |
| **מיון ללא סינון לפי updatedAt** (Q4) | **2,547** reads, ‏**Sort** של כל הטבלה, ‏**Memory Grant ‏79 MB**, ‏**DOP 10**, ‏49 ms | **62** reads, בלי Grant, ‏DOP 1, ‏0 ms | אינדקס `(UpdatedAt)` – השאילתות שנתקעו ב־M3 בהמתנה ל־Memory Grant |
| **דף עמוק** (Q5: דף 1000 × 100) | **306,484** reads, ‏164 ms | **525** reads, ‏12 ms | Deferred Join (סעיף 6.1) |
| **עדכון סטטוס** (W1, עלות כתיבה) | 24 reads, ‏1,544 bytes ב־log | 23 reads, ‏**1,396** bytes | למרות 3 אינדקסים נוספים – כתיבה **זולה** יותר (סעיף 5) |

**דף 1 של Q1 (779 ← 839 reads):** שתי המדידות באותם תנאים (אותם נתונים, אותה מכונה, בהפרש של דקה), אבל לא אותה שאילתה: 839 הוא ה־Deferred Join (סעיף 6.1), שממיין את 20 שורות הדף אחרי ה־Join (Grant של 1 MB). תוספת קטנה ואמיתית בדף הראשון (0 ms בשתיהן), שאותו שינוי מוריד בדף 1000 מ־306,484 ל־525 reads.

**סיכום האינדקסים:** 8 אינדקסים על `Requests` במקום 5, אבל **הנפח הכולל קטן** (30.7 ← 27.6 MB של אינדקסים לא־Clustered), ועדכון סטטוס **כותב פחות** ל־log.

**זמני תגובה מקצה לקצה דרך ה־API** (נמדדו בסקריפט האימות `verify-read-api.js` בזמן הפיתוח – הוסר ב־#54; חציון של 15 קריאות, כולל HTTP, אימות טוקן ו־JSON):

| תרחיש | M2 | M8 |
|---|---|---|
| חיפוש `search=bonus` | 480 ms | **62 ms** |
| מיון לפי title | 121 ms | **11 ms** |
| דף 1000 | 216 ms | **17 ms** |
| רשימה ללא סינון | 21 ms | 13 ms |
| summary (מה־Cache) | 114 ms (לפני ה־Cache) | 0 ms |

הטבלה המלאה של כל 26 המדידות – [נספח א'](#נספח-א--כל-המדידות).

## 2. הסינון והדפדוף מתבצעים ב־DB

אף פעם לא נטענת הטבלה לזיכרון של השרת. `RequestRepository.GetPageAsync` בונה שאילתת LINQ אחת (`IQueryable`), ו־EF Core מתרגם אותה ל־SQL עם כל התנאים, המיון וה־OFFSET/FETCH. בנוסף:

- **Projection:** נשלפות רק 9 העמודות שהרשימה צריכה (`Select(ToRow)`), לא ה־Entity כולו.
- **`AsNoTracking`:** EF לא שומר עותק של השורות.
- **ספירה:** `COUNT(*)` נפרד, גם הוא ב־DB.

זה ה־SQL ש־EF שולח עבור Q1, כפי שנלכד מלוג הפקודות של EF:

```sql
-- 1. כמות התוצאות (למספרי העמודים)
SELECT COUNT(*)
FROM [Requests] AS [r]
WHERE [r].[Status] IN (@statuses1, @statuses2) AND [r].[Priority] = @priorities1

-- 2. דף אחד (Deferred Join, סעיף 6.1): הסינון, המיון וה־OFFSET בשאילתה הפנימית, על Id בלבד
SELECT [r0].[Id], [r0].[Title], [r0].[OrganizationName], [r0].[Status], [r0].[Priority],
       [r0].[AssignedTo], [r0].[CreatedAt], [r0].[UpdatedAt], [r0].[RowVersion]
FROM (
    SELECT [r].[Id]
    FROM [Requests] AS [r]
    WHERE [r].[Status] IN (@statuses1, @statuses2) AND [r].[Priority] = @priorities1
    ORDER BY [r].[CreatedAt] DESC, [r].[Id] DESC
    OFFSET @p ROWS FETCH NEXT @p3 ROWS ONLY
) AS [r1]
INNER JOIN [Requests] AS [r0] ON [r1].[Id] = [r0].[Id]
ORDER BY [r0].[CreatedAt] DESC, [r0].[Id] DESC
```

- **פרמטרים:** כל הערכים, כולל OFFSET ו־FETCH, הם פרמטרים, ולכן SQL Server משתמש ב־Plan אחד לכל מספר עמוד. גודל הדף מוגבל ל־100 (D‑18).
- **Tie-breaker:** ‏`Id` הוא מפתח המיון האחרון, כך שהסדר יציב בין דפים.

## 3. שיטת המדידה

**הכלי:** `scripts/MeasureQueries.cs` (ב־Repo של ה־Backend, ‏C# file-based app). הוא מריץ ישירות מול SQL Server את **ה־SQL המדויק ש־EF מייצר**, באותו טקסט ובאותם סוגי פרמטרים (‏`sp_executesql`). ה־SQL נלכד מלוג הפקודות של EF כשה־API רץ. לכל שאילתה:

| שלב | מה עושים |
|---|---|
| חימום | שתי הרצות לחימום (קומפילציה וטעינת דפים) |
| מדידת קריאות | הרצה אחת עם `SET STATISTICS IO ON` ו־`SET STATISTICS XML ON`: ‏**logical reads** לכל טבלה, וה־**Execution Plan בפועל**. ה־Plan נשמר כקובץ `.sqlplan` (נפתח ב־SSMS) ומסוכם כעץ אופרטורים בטקסט, עם שורות בפועל, Sort, ‏Key Lookup, ‏Memory Grant ו־DOP |
| מדידת זמן | 10 הרצות עם `SET STATISTICS TIME ON`: חציון של CPU ו־elapsed בשרת, וזמן מקצה לקצה בלקוח |
| עלות כתיבה (W1) | שינוי סטטוס אחד בדיוק כמו ב־Repository (‏`UPDATE … OUTPUT` והכנסת היסטוריה), בטרנזקציה שמבוטלת (Rollback): reads, ‏Plan (אילו אינדקסים מתוחזקים), ו־**bytes שנכתבו ל־log** (`sys.dm_tran_database_transactions`) |
| נפח | גודל כל אינדקס (`sys.dm_db_partition_stats`) |

**אימות ה־SQL המועתק (27.10.2026, ‏Backend ב־commit `43dc4ed`):** הרצה חד־פעמית של ה־`RequestRepository` האמיתי מול המסד המקומי, עם לכידת כל פקודה ש־EF Core שולח, והשוואה למחרוזות של `scripts/MeasureQueries.cs` (הצורה `final`) – 32 פקודות: Q1–Q7 (COUNT ודף), ה־summary (Q8, שלוש שאילתות) וההיסטוריה (Q9). **25 זהות** (18 תו בתו, 7 שונות ברווחים בלבד). **ב־7 שאילתות הדף עם סינון** (Q1.page, ‏Q1s.page, ‏Q2.page, ‏Q6.page, ‏Q7a–c.page) ההבדל היחיד הוא **שם** הפרמטר של `FETCH NEXT` (EF: ‏`@p2`/`@p3`/`@p7`, בכלי: ‏`@p1`); הטקסט, התנאים, סוגי הפרמטרים וגודליהם זהים. שם של פרמטר לא משנה את ה־Plan ואת ה־logical reads, ולכן ההבדל לא משפיע על התוצאות במסמך. קוד האימות לא נשמר ב־Repo.

**כללי זהירות** (המופע משותף עם מסדים אחרים):
- אין פקודות ברמת המופע: לא `DBCC FREEPROCCACHE`/`DROPCLEANBUFFERS`, ולא שינוי הגדרות. ניקוי Plans נעשה רק למסד הזה, עם `ALTER DATABASE SCOPED CONFIGURATION CLEAR PROCEDURE_CACHE`.
- ניסויי כיבוי אינדקס רצים רק במסד בשם `RequestsManagement` ולא על ה־Clustered Index. ה־REBUILD מתבצע ב־`finally`, ובסוף כל ריצה יש בדיקה שכל האינדקסים פעילים.

**תהליך:**
1. `seed --reset`
2. `UPDATE STATISTICS … WITH FULLSCAN`
3. מדידת בסיס
4. ניסויים (כיבוי כל אינדקס קיים, הוספת מועמדים)
5. Migration
6. מדידה חוזרת

אותן שאילתות ואותם פרמטרים בכל השלבים. ‏`--shape original` מריץ את ה־SQL שלפני M8.

**ממצא מתודולוגי – פיצול אחרי ה־Seed:** מדידת הבסיס הראשונה הראתה ש־Q1.count קורא 1,118 דפים, ואחרי REBUILD של אותו אינדקס רק 697. הסיבה: ה־Seed טוען ב־`SqlBulkCopy` לטבלה שהאינדקסים הלא־Clustered שלה כבר קיימים, וההכנסה מפצלת דפים. האינדקסים נשארו **מלאים רק ב־35%–61%**:

| אינדקס | KB אחרי ה־Seed | KB אחרי REBUILD | מילוי |
|---|---|---|---|
| ‏`IX_Requests_CreatedAt` | 5,168 | 1,800 | 35% |
| ‏`IX_Requests_OrganizationName` | 10,968 | 5,984 | 55% |
| ‏`IX_Requests_AssignedTo_Status` | 6,072 | 3,536 | 58% |
| ‏`IX_Requests_Status_Priority_CreatedAt` | 31,736 | 19,416 | 61% |

השוואה הוגנת מחייבת אינדקסים דחוסים בכל השלבים, ולכן **כל ההשוואות במסמך (`before` ← `final`) נמדדו על אינדקסים דחוסים**. בעקבות הממצא ה־Seeder מריץ עכשיו `ALTER INDEX ALL … REBUILD` על שתי הטבלאות שלנו בלבד אחרי הטעינה (כ־1.2 שנ'), ובודק שמריץ את ה־Seed מקבל אינדקסים מלאים ב־98–99%.

**סביבה ואמינות הזמנים:**
- **שרת:** ‏SQL Server 2025 Developer (17.0.1145), ‏compatibility 170, ‏MAXDOP 10, ‏cost threshold 5 (ברירות מחדל של המופע, לא שונו).
- **אפליקציות ברקע:** חלקן נסגרו לפני המדידה, אבל **חלק מאפליקציות הרקע עדיין רצו**.
- **זיכרון:** בכל ריצה נרשם הזיכרון בתחילתה ובסופה (בטבלה למטה).
- **Paging:** יומן השגיאות של SQL Server רשם 23 הודעות "process memory has been paged out" בשעות המדידה.

**לכן הזמנים הם מדד משני ומשמשים רק להשוואה גסה.** המסקנות נשענות על logical reads ועל צורת ה־Plan.

| ריצה | פנוי ב־OS בתחילה / בסוף (MB) | ‏SQL Server: מוקצה / יעד בתחילה (MB) |
|---|---|---|
| ‏`before-fragmented` | 4,479 / 4,356 | 447 / 4,120 |
| ‏`before` | 3,542 / 3,426 | 447 / 3,199 |
| ‏`after-indexes` | 2,775 / 2,764 | 639 / 2,640 |
| ‏`final` | 2,778 / 2,770 | 657 / 2,629 |

## 4. ה־Plans של הפעולות המרכזיות

העצים מתוך קבצי ה־`.sqlplan`, עם מספר השורות בפועל. הקבצים המלאים ב־[`performance/before/plans`](performance/before/plans) וב־[`performance/final/plans`](performance/final/plans).

**Q4 – מיון לפי updatedAt בלי סינון (דף 1):**
```
לפני – 2,547 reads, Memory Grant 79,440 KB, DOP 10
Top – 20 rows
  Parallelism (Gather Streams) – 20 rows
    Sort – 3,610 rows
      Index Scan [IX_Requests_Status_Priority_CreatedAt] – 100,000 rows

אחרי – 62 reads, Grant 1,024 KB (מיון של 20 שורות בלבד), DOP 1
Sort – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Top – 20 rows
      Index Scan [IX_Requests_UpdatedAt] – 20 rows        ← נקרא מהסוף: הסדר מוכן, אין Sort של הטבלה
    Clustered Index Seek [PK_Requests] – 20 rows, 20 executions
```
- **לפני:** כל 100,000 השורות נקראות וממוינות כדי להחזיר 20, בתוכנית מקבילית עם בקשה ל־79 MB זיכרון. כש־SQL Server מוגבל בזיכרון, השאילתה ממתינה ל־Grant (`RESOURCE_SEMAPHORE`), וזו הקפיאה שאובחנה ב־M3.
- **אחרי:** נקראות 20 שורות מהאינדקס, ואחריהן 20 שורות מלאות.

**Q5 – דף עמוק (OFFSET 99,900):**
```
לפני – 306,484 reads
Top – 100 rows
  Nested Loops (Inner Join) – 100,000 rows
    Index Scan [IX_Requests_CreatedAt] – 100,000 rows
    Key Lookup [PK_Requests] – 100,000 rows, 100,000 executions   ← שורה מלאה לכל שורה שמדלגים עליה

אחרי – 525 reads
Sort – 100 rows
  Nested Loops (Inner Join) – 100 rows
    Top – 100 rows
      Index Scan [IX_Requests_CreatedAt] – 100,000 rows   ← הדילוג על אינדקס צר (Id בלבד)
    Clustered Index Seek [PK_Requests] – 100 rows, 100 executions
```

**Q6 – חיפוש (COUNT):** צורת ה־Plan כמעט זהה, סריקה מלאה של 3,291 התאמות מתוך 100,000. ההבדל הוא בעלות ההשוואה של כל שורה (סעיף 6.2):
```
לפני – 2,427 reads, 397 ms                              אחרי – 2,460 reads, 52 ms
Compute Scalar                                          Compute Scalar
  Stream Aggregate – 1 rows                               Stream Aggregate – 1 rows
    Index Scan [IX_Requests_Status_Priority_CreatedAt]      Clustered Index Scan [PK_Requests] – 3,291 rows
      – 3,291 rows   (האינדקס הרחב עם INCLUDE)               (ההשוואה: UPPER(...) COLLATE Latin1_General_100_BIN2)
```

**Q1 – רשימה ראשית (COUNT):** אותו Plan, ‏Index Seek על `IX_Requests_Status_Priority_CreatedAt` לשני ערכי הסטטוס. האינדקס הצר קטן פי 10, ולכן 697 ← 76 reads:
```
Stream Aggregate – 1 rows
  Nested Loops (Inner Join) – 5,689 rows
    Merge Interval – 2 rows          ← שני ערכי Status (IN)
    Index Seek [IX_Requests_Status_Priority_CreatedAt] – 5,689 rows, 2 executions
```

## 5. אינדקסים: החלטה לכל אחד

**השיטה:**
- **אינדקס קיים:** כובה לריצה אחת (`--disable`), ונבדק אילו שאילתות נפגעות ומה נחסך בכתיבה (W1).
- **אינדקס מועמד:** נוצר זמנית ונמדד, ואז נמחק.

תוצאות הניסויים מסוכמות לכל אינדקס בסעיפים 5.1–5.3; המצב הסופי מול הבסיס, עם האינדקסים שכל שאילתה השתמשה בהם – [`performance/final/compare-with-before.md`](performance/final/compare-with-before.md), וה־Plans ב־[`performance/final/plans`](performance/final/plans).

**כלל ההחלטה (נקבע לפני המדידה):**
- **הוספה:** רק אם האינדקס מבטל Sort/Memory Grant, או מוריד logical reads בסדר גודל לתרחיש מהסט, ותוספת עלות הכתיבה (W1) קטנה.
- **הסרה או שינוי:** אינדקס שאף תרחיש לא צריך, או שעלותו גדולה מהרווח.

### 5.1 האינדקסים של M1

| אינדקס (M1) | החלטה | מדידה |
|---|---|---|
| ‏`(Status, Priority, CreatedAt DESC)` ‏INCLUDE (Title, OrganizationName, AssignedTo, UpdatedAt, RowVersion) | **שונה** ל־`(Status, Priority, CreatedAt)` – מפתחות בלבד, בסדר עולה | **הרווח מה־INCLUDE היה קטן:** הוא הפך את האינדקס לכמעט עותק של הטבלה (19.4 MB, ‏63% מכל האינדקסים), ובלעדיו Q1.count עולה 697 ← 2,643. **אבל המחיר גבוה:** בלי האינדקס, עדכון סטטוס כותב **40% פחות log** (1,544 ← 928 bytes), כי ה־Status במפתח ו־UpdatedAt/RowVersion ב־INCLUDE משתנים בכל עדכון. **הגרסה הצרה:** ‏Q1.count ‏697 ← **75**, ‏Q1s.page בלי Sort, ‏W1 ‏1,544 ← 1,176, נפח 2 MB |
| ‏`(AssignedTo, Status)` | **שונה** ל־`(AssignedTo, CreatedAt)` ‏INCLUDE (Status) | ה־COUNT של מטפל השתמש בו (15 reads; בלעדיו 2,425), אבל **הדף לא**: 2,408 reads דרך Key Lookups. עם CreatedAt במפתח: הדף ‏2,408 ← **63**. ‏Status ב־INCLUDE מתעדכן במקום, בלי להזיז את השורה (W1 ‏1,544 ← 1,508) |
| ‏`(OrganizationName)` | **שונה** ל־`(OrganizationName, CreatedAt)` | ה־COUNT של תחילית ארגון: 49 reads; בלעדיו 2,427. אחרי ה־Deferred Join נוצר בדף Hash Join עם `IX_Requests_CreatedAt` ו־Sort (‏23 ms, ‏Grant 5 MB). עם CreatedAt במפתח: ‏334 ← **116** reads, ‏2 ms. שתי העמודות לא משתנות לעולם, ולכן אין עלות בעדכון סטטוס |
| ‏`(CreatedAt)` | **נשאר** | המיון ברירת המחדל וכל דף מסונן. בלעדיו: דף החיפוש 2 ← 380 ms, דף ברירת מחדל 70 ← 2,547 reads עם Sort ו־Grant של 79 MB. ‏CreatedAt לא משתנה, ולכן אין עלות כתיבה |
| History: ‏`(RequestId, ChangedAt)` | **נשאר** | ההיסטוריה של פנייה: 9 reads (Seek). משמש גם את ה־FK |

**ממצא – `DESC` במפתח הפריע:**
- **הבעיה:** הרשימה ממוינת `CreatedAt DESC, Id DESC`, וכל אינדקס לא־Clustered מסתיים ב־`Id` (מפתח ה־Clustered) **בסדר עולה**. אינדקס `(…, CreatedAt DESC)` נותן `CreatedAt DESC, Id ASC`, שלא מתאים ל־Tie-breaker, ולכן SQL Server ממיין בכל זאת.
- **הפתרון:** אינדקס בסדר עולה שנקרא מהסוף נותן בדיוק `DESC, DESC`.
- **המדידה:** Q1s.page ‏(`New` + ‏`High`) עם מפתח DESC: ‏672 reads ו־Sort; עם מפתח עולה: ‏70 reads, בלי Sort. בדיקה זהה עבור `(AssignedTo, CreatedAt DESC)`: הדף לא השתמש בו בכלל.
- **המסקנה:** כל המפתחות החדשים בסדר עולה, עם הערה בקוד (`RequestConfiguration.cs`).

### 5.2 אינדקסים חדשים למיון

| אינדקס | החלטה | רווח | עלות |
|---|---|---|---|
| ‏`(UpdatedAt)` | **נוסף** | ‏Q4.updated: ‏2,547 + Sort ‏79 MB ‏DOP 10 ← **62**, בלי Grant; ‏Q2 (סינון + updatedAt): ‏Sort ‏8 MB ← בלי Sort | ‏UpdatedAt משתנה בכל עדכון: ‏W1 **+16%** (1,544 ← 1,788 bytes כשנמדד לבד). 1.8 MB |
| ‏`(Priority)` | **נוסף** | ‏Q4.priority: ‏2,547 + ‏79 MB ← **62**; גם Q8.priority ‏2,427 ← 138 | **אפס בעדכון סטטוס** (Priority לא משתנה); 1.1 MB |
| ‏`(Title)` | **נוסף** | ‏Q4.title: ‏2,547 + ‏79 MB ‏DOP 10 ← **63** | **אפס בעדכון סטטוס**. הנפח הגדול מבין החדשים (9.7 MB). בדף עמוק לפי title עבר ה־Optimizer ל־100,000 Key Lookups (‏2,547 ← 307,477 reads באותו זמן). ה־Deferred Join (6.1) פתר את זה: **1,518** |
| ‏`(Status)` | **נדחה** | ‏Q4.status ‏2,547 ← 70 | ‏W1 **+15%** (1,544 ← 1,776) **בכל** שינוי סטטוס, בשביל מיון לפי עמודה עם 4 ערכים (63% מהפניות `Completed`). את הספירה לפי סטטוס ב־summary כבר משרת האינדקס הצר, וה־summary ב־Cache. ה־Deferred Join מקטין את ה־Grant שנשאר (79 ← 15 MB) |

**מיון לפי Priority או Status בלי סינון:** אלה התרחישים הפחות שימושיים, ולכן הם נבחנו בקפדנות במיוחד. מה שהכריע הוא **עלות הכתיבה**:
- **Priority:** לא משתנה בעדכון סטטוס, כך שהאינדקס עולה רק בהכנסת פנייה חדשה ו־1.1 MB. הוא עומד בכלל ההחלטה.
- **Status:** משתנה בכל עדכון, והמחיר (+15% לכל שינוי, הפעולה המרכזית של המערכת) גדול מהרווח במיון נדיר.

### 5.3 התוצאה הכוללת

| | M1 (לפני) | M8 (אחרי) |
|---|---|---|
| מספר אינדקסים על `Requests` (כולל ה־PK) | 5 | 8 |
| נפח האינדקסים הלא־Clustered | 30,736 KB | **27,576 KB** |
| נפח ה־Clustered (PK) | 21,144 KB | 19,680 KB |
| עדכון סטטוס (W1): ‏log bytes / reads | 1,544 / 24 | **1,396 / 23** |
| אינדקסים שעדכון סטטוס מתחזק | 3 (PK, ‏AssignedTo_Status, ‏Status_Priority_CreatedAt) | 4 (PK, ‏AssignedTo_CreatedAt, ‏Status_Priority_CreatedAt, ‏UpdatedAt) |

עדכון סטטוס מתחזק עכשיו אינדקס אחד יותר, ובכל זאת כותב פחות. הסיבה: האינדקס הרחב, שבו כל שורה מכילה את כל עמודות הרשימה ועוברת מקום בכל עדכון, הוחלף באינדקסים צרים שמכילים מפתחות בלבד.

### 5.4 רגרסיה מוכרת: Q8.orgs (ארגונים מובילים ב־summary)

- **המספרים:** ‏Q8.orgs עלה מ־22 ל־**40 ms** (בריצות אחרות 51–58 ms, עם רעש הזיכרון), עם Grant של 12 MB במקום 1.7 MB.
- **הסיבה:** הסרת ה־INCLUDE מ־`IX_Requests_Status_Priority_CreatedAt`. ה־INCLUDE הכיל את `OrganizationName`, ולכן ה־GROUP BY על הפניות הפתוחות קרא אינדקס אחד. עכשיו SQL Server מצליב שני אינדקסים, `Status_Priority_CreatedAt` עם `OrganizationName_CreatedAt`, ב־Hash Join:

```
לפני                                                אחרי
Hash Match (Aggregate) – 400 rows                    Hash Match (Aggregate) – 400 rows
  Index Seek [IX_..._Status_Priority_CreatedAt]        Hash Match (Inner Join) – 37,128 rows
    – 37,128 rows (OrganizationName ב־INCLUDE)            Index Seek [IX_..._Status_Priority_CreatedAt] – 37,128 rows
                                                          Index Scan [IX_..._OrganizationName_CreatedAt] – 100,000 rows
```

**למה מקבלים את זה ולא מוסיפים אינדקס:**
- **ה־Cache:** ה־summary נשמר ב־Cache ל־60 שנ' ומתנקה רק בשינוי סטטוס (D‑11, ‏D‑20). כלומר השאילתה רצה לכל היותר פעם בדקה, או אחרי שינוי, ולא בכל טעינת מסך. מקצה לקצה זמן ה־summary הוא 0 ms ב־Hit.
- **מה פיצוי היה עולה:** `INCLUDE (Status)` על אינדקס הארגון היה גורם לכל עדכון סטטוס לכתוב אליו (כמו ב־M1), כלומר מחיר בכל עדכון בשביל שאילתה שרצה פעם בדקה.

## 6. שינויים בשאילתות

### 6.1 Deferred Join לדפדוף

**הבעיה:** ‏`OFFSET n` קורא ומדלג על n שורות. כשהשאילתה מחזירה שורות מלאות, SQL Server בוחר באחת משתי דרכים, ושתיהן יקרות בדף עמוק:
- למיין את כל הטבלה (Grant גדול, ‏DOP 10).
- לעבור על אינדקס ולבצע **Key Lookup לכל שורה שעליה הוא מדלג**: 100,000 Lookups עבור דף 1000, כלומר 306,484 reads.

**הפתרון:** השאילתה הפנימית בוחרת **רק Id**, עם כל הסינונים, אותו מיון ואותו Tie-breaker. כך היא נענית מאינדקס צר, והשורות המלאות נקראות רק לדף עצמו.
- **מימוש:** ב־LINQ, ‏`pageIds.Join(db.Requests, …)` (בלי SQL גולמי).
- **חשוב:** ‏Join ולא `Contains` של שאילתה נפרדת. כשנוסה Contains, ‏EF הטמיע את ה־OFFSET/FETCH **כקבועים** בתוך תת־השאילתה, כלומר Plan חדש לכל מספר עמוד. עם Join הם נשארים פרמטרים.

| | לפני | אחרי |
|---|---|---|
| דף 1000, ‏createdAt (Q5.created) | 306,484 reads, ‏164 ms | **525**, ‏12 ms |
| דף 1000, ‏title (Q5.title) | 2,547 + ‏Grant 79 MB (‏307,477 עם אינדקס Title בלבד) | **1,518**, ‏11 ms |
| מיון לפי status (Q4.status, בלי אינדקס) | 2,547, ‏Grant 79 MB | 808, ‏Grant 15 MB |
| דף 1 (Q3.page) | 70 | 62 |

בכל דף נוסף Sort של 20–100 שורות בסוף, ה־ORDER BY החיצוני אחרי ה־Join, עם Grant של 1 MB. העלות זניחה.

### 6.2 חיפוש: ‏`UPPER` משני הצדדים והשוואה בינארית

**הניתוח:** בחיפוש (`LIKE '%x%'`) ה־I/O קטן: 2,427 דפים, כולם בזיכרון. **93% מהזמן הוא השוואת הטקסט הלשונית של Unicode** ב־collation של המסד, על 100,000 × 2 עמודות. אותה סריקה ב־collation בינארי (`A5.binary`) לקחה 46 ms במקום 397.

**המימוש:**
```sql
WHERE UPPER([r].[Title]) COLLATE Latin1_General_100_BIN2 LIKE UPPER(@pattern) ESCAPE N'\'
   OR UPPER([r].[OrganizationName]) COLLATE Latin1_General_100_BIN2 LIKE UPPER(@pattern) ESCAPE N'\'
```
- **`UPPER` רץ ב־SQL על שני הצדדים**, העמודה והפרמטר. ‏`AppDbContext.Upper` היא פונקציה שממופה ל־`UPPER` המובנה. ‏`ToUpper()` ב־C# על משתנה מקומי היה מחושב ב־.NET לפני השליחה, וכללי ה־case של .NET ושל SQL Server עלולים להיות שונים.
- **ה־Escaping** של `% _ [` לא השתנה (`UPPER` לא משנה אותם).
- **התוצאה:** **397 ← 52 ms** ב־COUNT (‏`A5.upper` לבד: 59 ms), ומקצה לקצה 480 ← 62 ms. אותן 3,291 התאמות כמו קודם, ו־`verify-read-api.js` (השוואה מול SQL ישיר, הוסר ב־#54) עבר.
- **בדיקות חדשות:**
  - מונח באותיות קטנות מוצא כותרת באותיות גדולות, וגם להפך.
  - מונח בעברית נמצא.
  - `% _ [` נשארים תווים רגילים, גם אחרי `UPPER`.
  - **הבדיקות נבדקו במוטציה:** הסרת `UPPER` מהפרמטר הכשילה 4 מתוך 6 מקרים, והסרת ה־Escaping הכשילה 2.

**המחיר בסמנטיקה (מתועד גם ב־D‑24):**
- **מה נשמר:** ההשוואה עדיין לא רגישה לאותיות גדולות/קטנות.
- **מה אבד:** **שקילויות לשוניות** של ה־collation, למשל `ae` מול `æ`, או צורות Unicode שונות של אותו תו, לא מתאימות יותר.
- **לגבי עברית:** אין לה אותיות גדולות, וה־collation של המסד ממילא רגיש לסימנים (`AS`), כך שמבחינה מעשית ההבדל זניח.

**זה עדיין Full Scan:** הזמן גדל ליניארית עם הטבלה. ב־1M+ פניות החיפוש יחזור למאות ms, וראו סעיף 7.1 לצעד הבא.

**חלופה שנמדדה ונדחתה:** ‏`COUNT(*) OVER()` כדי לחסוך את שאילתת ה־COUNT הנפרדת (A4). התוצאה הייתה **9,789 reads**, ‏Grant של 10 MB, ולא מהיר יותר: החלון מחייב לחשב את כל ההתאמות לפני ה־OFFSET.

## 7. ניתוח Bottleneck: מה נשאר ומה הלאה

### 7.1 חיפוש `LIKE '%x%'` – ה־Bottleneck העיקרי

**למה אין Seek:** אינדקס B‑Tree ממוין לפי תחילת הערך. התאמה של **תחילית** (`LIKE 'bonus%'`) היא Seek, למשל `A6.prefix`: ‏**3 reads**. התאמה **באמצע** המחרוזת חייבת לבדוק כל שורה. לכן גם אחרי M8 החיפוש סורק את כל הטבלה (2,460 reads, ~50 ms ל־100K), והזמן יגדל ליניארית.

| חלופה | יתרון | חיסרון | מתי |
|---|---|---|---|
| **Full‑Text Index** (`CONTAINS`) | אינדקס הפוך: מהיר מאוד גם במיליוני שורות | סמנטיקה של **מילים ותחיליות מילים**, לא תת־מחרוזת (`"onus"` לא ימצא `bonus`); אינדקס שמתעדכן אסינכרונית; **לא מותקן במופע הפיתוח, לא נתמך ב־LocalDB** (מסלול הבודקים, D‑17) ולא קיים ב־image של ה־CI | כשהמשתמשים מחפשים מילים שלמות, בשרת Production עם FTS |
| **טבלת n‑grams** (למשל טריגרמות → Id) | נשמרת סמנטיקת "מכיל" (כל מונח של 3+ תווים) | טבלה גדולה (שורה לכל רצף של 3 תווים – עשרות שורות לכל פנייה), תחזוקה בכל הכנסה ושינוי כותרת, שאילתה מורכבת יותר | מעל ~1M פניות, אם "מכיל" חובה |
| **אורך מינימלי למונח** (למשל 3 תווים) + ‏debounce ב־UI | זול; מפחית קריאות מיותרות (ב־M7 ממילא debounce + switchMap) | לא משנה את עלות החיפוש עצמו | כבר עכשיו, בצד ה־UI |
| שירות חיפוש חיצוני (Elasticsearch וכדומה) | חיפוש עשיר, דירוג | רכיב תשתית נוסף – Over‑Engineering כאן | רק בהיקף ובדרישות גדולים בהרבה |

**המלצה:** להשאיר את הפתרון הנוכחי (מספיק ל־100K, ‏~60 ms מקצה לקצה). בהיקף של 1M+, ‏**Full‑Text** בשרת שתומך בו, אם אפשר לקבל חיפוש מילים. אחרת **n‑grams**.

### 7.2 ‏OFFSET עמוק

ה־Deferred Join (6.1) הוריד את דף 1000 ל־525 reads. **הוא לא מבטל את הבעיה:** השאילתה הפנימית עדיין עוברת על 100,000 מפתחות (על אינדקס צר), כלומר הדילוג עדיין ליניארי במספר הדף.

| חלופה | יתרון | חיסרון |
|---|---|---|
| **Keyset Pagination** (`WHERE (CreatedAt, Id) < (@lastCreatedAt, @lastId)`) | עלות קבועה לכל דף, בלי קשר לעומק; יציב גם כשנוספות שורות | אין "קפיצה לעמוד 734": רק הבא/הקודם; ה־API מקבל cursor במקום מספר עמוד; ה־UI (‏mat-paginator עם מספרי עמודים) משתנה; לכל שדה מיון צריך אינדקס תואם |
| הגבלת עומק (למשל עד עמוד 500 – "צמצמו את החיפוש") | פשוט | פוגע במשתמש שבאמת צריך דף עמוק |

**המלצה:**
- **עכשיו:** להשאיר Offset (D‑12; מתאים ל־UI עם מספרי עמודים, והדף העמוק ביותר עולה 12 ms).
- **בהיקף גדול או בגלילה אינסופית:** לעבור ל־Keyset.

### 7.3 ‏COUNT בכל דף

כל קריאה לרשימה מריצה `COUNT(*)` כדי להציג מספרי עמודים. עם הסינונים הנתמכים באינדקס זה זול (8–138 reads). בחיפוש זה עוד Full Scan. חלופות:
- `COUNT(*) OVER()` (נמדד, גרוע יותר).
- Cache של הספירה לפי הפילטר.
- "יש עוד דפים" במקום ספירה מדויקת.

אף אחת לא מוצדקת ב־100K.

### 7.4 ‏Summary – ‏Indexed View או טבלת סיכום?

- **Indexed View:** ‏`COUNT_BIG` לפי Status/Priority היה הופך את ה־summary ל־O(1). המחיר: עדכון ה־View **בכל** שינוי סטטוס, כלומר נקודה חמה אחת שכל הכותבים נועלים, והגבלות SET options.
- **ה־Cache מספיק:** ה־summary כבר ב־Cache (D‑11), והשאילתות עצמן ירדו ל־138–251 reads (מלבד Q8.orgs, סעיף 5.4).
- **המלצה:** לא מוצדק. רלוונטי רק בהרבה מופעים בלי Cache משותף (ראו `CACHE.md`).

### 7.5 מיון לפי Status בלי סינון

נשאר עם Sort ו־DOP 10, ואחרי ה־Deferred Join עם Grant של 15 MB במקום 79 MB (808 reads). זו החלטה מודעת, סעיף 5.2. אם יתברר שזה מיון נפוץ, הצעד הבא הוא אינדקס `(Status)` במחיר של +15% לכל עדכון סטטוס.

## 8. הסיכון מ־M6 (בדיקות): Timeout של 30 שנ'

- **הרקע:** ב־M6 נכשלה פעם אחת מקומית `BulkStatusTests.AFullCallOfHundredRequests…` עם `500` אחרי 35 שנ'. יומן השגיאות של SQL Server הראה אז "process memory has been paged out".
- **מה נמצא ב־M8:**
  - **הבדיקה לא תלויה באינדקסים:** היא עובדת על מסד הבדיקות הקטן (עשרות שורות), וכל פריט ב־Bulk הוא `UPDATE` לפי PK והכנסת שורה. אין בה Sort ואין Memory Grant, ולכן האינדקסים לא יכולים לבטל את ה־Timeout שלה. הסיבה הייתה סביבתית: זיכרון של SQL Server שנדחק לדיסק.
  - **מה כן השתנה:** עדכון סטטוס זול יותר (פחות log), אבל ההבדל זניח בבדיקה הזו.
  - **מה האינדקסים כן ביטלו:** הקפיאות שאובחנו ב־M3 **מול 100K הרשומות**: ‏Sort עם Grant של 79 MB ו־DOP 10 בכל מיון לפי updatedAt/priority/title. אלה השאילתות שהמתינו ל־`RESOURCE_SEMAPHORE` עד 68 שנ'. עכשיו הן ‏62 reads, בלי Grant, ‏DOP 1.
  - **5 הרצות רצופות** של כל הבדיקות (129) אחרי השינויים: כולן עברו (5–6 שנ' כל אחת), ו**אף הודעת paging** ביומן במהלכן. בזמן המדידות שלפניהן היו 23.
- **המסקנה:** לא ניתן להוכיח שהכשל לא יחזור. הוא לא שוחזר גם ב־10 הרצות ב־M6. הסיכון הסביבתי נשאר מתועד (README של BE).

## 9. גרסאות Seeder: v1 (אנגלית) מול v2 (עברית, D‑33)

**מה השתנה:** רק רשימות המילים (`SeedWordLists.cs`). כל רשימה שמרה על אותו **מספר** פריטים, ולכן סדר קריאות ה־`Random` זהה, והסטטוסים, העדיפויות, התאריכים, המטפלים, ההיסטוריה (179,178 שורות) ובחירת הארגון לכל פנייה זהים בשתי הגרסאות. שם ארגון הוא "קידומת + ענף + סיומת", והשפה נקבעת לפי הקידומת (קידומת עברית ← ענף וסיומת בעברית), כך שכ־48% מהפניות הן של ארגון בעברית ושם לא מערבב שפות.

**מדידה:** אותו כלי, אותה מכונה, אותם תנאים, על נתונים אחרי `seed --reset`; התוצאות ב־[`performance/seed-v2-hebrew/`](performance/seed-v2-hebrew), וההשוואה המלאה v1 ← v2 ב־[`compare-with-seed-v1-english.md`](performance/seed-v2-hebrew/compare-with-seed-v1-english.md). v1 נמדד מחדש לפני השינוי ותאם ל־`final/` (reads זהים או עד 1% הפרש). בחיפוש הוחלפה המילה `bonus` ב־`בונוס` (אותה תת־קבוצה של פניות: 3,291 במלואה).

| פעולה | Logical reads v1 → v2 | Elapsed ms v1 → v2 | Plan |
|---|---|---|---|
| רשימת ברירת מחדל (Q3.page) | 62 → 62 | 0 → 0 | זהה |
| מיון לפי כותרת (Q4.title) | 63 → 63 | 0 → 0 | זהה |
| דף 1000 לפי תאריך יצירה (Q5.created) | 525 → 525 | 12 → 7 | זהה |
| דף 1000 לפי כותרת (Q5.title) | 1,518 → 1,218 (−19.8%) | 12 → 11.5 | זהה |
| חיפוש `LIKE '%x%'` – COUNT (Q6.count) | 2,460 → 2,117 (−13.9%) | 54 → 47 | זהה |
| חיפוש – דף (Q6.page) | 1,698 → 1,698 | 1 → 1 | זהה |
| Summary: ארגונים מובילים (Q8.orgs) | 943 → 899 (−4.7%) | 48 → 36.5 | זהה |
| עדכון סטטוס (W1) | 23 → 23, log 1,396 bytes | 0 → 0 | זהה |

כל 26 השאילתות: אותה צורת Plan, ללא Sort, ‏Memory Grant או מקביליות חדשים, ו־logical reads בטווח `+0%`…`−19.8%` (הטבלה המלאה: [`gate-g3.md`](performance/seed-v2-hebrew/gate-g3.md)).

**הסבר להפרשים:** כל הירידות הן בשאילתות שקוראות את עמודת הטקסט (`Title` / `OrganizationName`): כותרת בעברית קצרה מהאנגלית (ממוצע 29 תווים, מקסימום 54), ולכן פחות דפים נקראים. נפח האינדקסים הלא־Clustered ירד מ־27,576 ל־24,824 KB, והטבלה (Clustered) מ־19,680 ל־16,936 KB. זה שינוי בנתונים ולא ביעילות השאילתה, ולכן מספרי v1 וה־v2 אינם להחלפה זה בזה.

**חיפוש בעברית (UPPER + BIN2, סעיף 6.2):** תוצאות החיפוש זהות לשאילתת `LIKE` ישירה על ה־DB לתת־מחרוזות, ביטוי עם רווח, שם ארגון שלם ו־`בע״מ` (עם גרשיים עבריים, U+05F4); עברית אינה רגישה לאותיות גדולות/קטנות, ו־`UPPER` לא משנה אותה. מיון לפי כותרת בעברית הוא אותו `ORDER BY` על העמודה ולכן זהה ל־SQL (נבדק ב־500 שורות בכל כיוון). **מגבלה:** ההשוואה הבינארית אינה מתעלמת מניקוד (ניקוד אינו קיים בנתונים).

**ראיות לשערי הקבלה G1, G2, G6 (הורצו ב־24.10.2026 על Seeder v2, מול `Server=.`; לפני כן ואחרי כן המסד נזרע מחדש):**

| שער | ראיה |
|---|---|
| G1 – בדיקות | ‏BE: ‏**139 בדיקות, ‏139 עברו, ‏0 נכשלו, ‏0 דולגו** (‏67 יחידה, ‏72 Integration), ‏6 שנ'. ‏FE (Vitest): ‏**336 בדיקות ב־30 קבצים, כולן עברו**. (תמונת מצב היסטורית מ־24.10.2026; המספרים העדכניים – ב־[README](../README.md#בדיקות).) |
| G2 – אימות מול 100K | ‏`verify-read-api` (הוסר ב־#54) – ‏ALL CHECKS PASSED, ‏90 בדיקות (ה־API מול SQL ישיר על כל 100,000 הפניות, כולל מיון כותרות בעברית). |
| G6 – אורכי עמודות | ‏`Title`: מקסימום **54** תווים, ממוצע **29.5** (העמודה `nvarchar(200)`); ‏`OrganizationName`: מקסימום **34** תווים (העמודה `nvarchar(150)`), ‏400 ארגונים שונים; ‏**100,000** מתוך 100,000 כותרות בעברית, ו־**47,907** פניות (47.9%) של ארגון עם שם בעברית. |

## נספח א' – כל המדידות

"לפני" = אינדקסי M1 (דחוסים) וה־SQL של M2. "אינדקסים" = אינדקסי M8 עם ה־SQL של M2. "סופי" = אינדקסי M8 עם ה־SQL של M8. ‏Sort/Grant/DOP/זמן: לפני ← סופי. בשורות הדף, "Sort – כן" עם Grant של 1,024 KB בסופי הוא המיון של 20–100 השורות אחרי ה־Join.

| Id | תרחיש | Logical reads: לפני → אינדקסים → סופי | Sort | Memory Grant KB | DOP | Elapsed ms (חציון) |
|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 697 → 75 → **76** | כן → כן | 1,024 → 1,024 | 1 → 1 | 1 → 1 |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 779 → 779 → **839** | – → כן | – → 1,024 | 1 → 1 | 0 → 0 |
| Q1s.count | list: status=New + priority=High – COUNT | 44 → 8 → **8** | – → – | – → – | 1 → 1 | 0 → 0 |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 44 → 70 → **62** | כן → כן | 6,656 → 1,024 | 1 → 1 | 0 → 0 |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 697 → 439 → **499** | כן → כן | 8,352 → 1,024 | 1 → 1 | 4 → 0 |
| Q3.count | list: no filter – COUNT | 225 → 138 → **138** | – → – | – → – | 1 → 1 | 6 → 10 |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 70 → 70 → **62** | – → כן | – → 1,024 | 1 → 1 | 0 → 0 |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 2,547 → 70 → **62** | כן → כן | 79,440 → 1,024 | 10 → 1 | 49 → 0 |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 2,547 → 70 → **62** | כן → כן | 79,440 → 1,024 | 10 → 1 | 58 → 0 |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 2,547 → 2,579 → **808** | כן → כן | 79,440 → 14,968 | 10 → 10 | 58 → 46 |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 2,547 → 71 → **63** | כן → כן | 79,440 → 1,024 | 10 → 1 | 88 → 0 |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 306,484 → 306,484 → **525** | – → כן | – → 1,024 | 1 → 1 | 164 → 12 |
| Q5.title | deep page 1000 x 100, sort title asc | 2,547 → 307,477 → **1,518** | כן → כן | 79,440 → 1,024 | 10 → 1 | 165 → 11 |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 2,427 → 2,067 → **2,460** | – → – | – → – | 1 → 1 | 397 → 52 |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 1,638 → 1,638 → **1,698** | – → כן | – → 1,024 | 1 → 1 | 1 → 0 |
| Q7a.count | assignedTo=adi.ezra – COUNT | 15 → 19 → **19** | – → – | – → – | 1 → 1 | 0 → 0 |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 2,408 → 71 → **63** | – → כן | – → 1,024 | 1 → 1 | 0 → 0 |
| Q7b.count | organization=Hermon (prefix) – COUNT | 49 → 56 → **56** | – → – | – → – | 1 → 1 | 1 → 1 |
| Q7b.page | organization=Hermon, page 1 x 20 | 580 → 580 → **116** | – → כן | – → 1,888 | 1 → 1 | 0 → 2 |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 13 → 13 → **13** | – → – | – → – | 1 → 1 | 0 → 0 |
| Q7c.page | January 2026, page 1 x 20 | 70 → 70 → **62** | – → כן | – → 1,024 | 1 → 1 | 0 → 0 |
| Q8.status | summary: count by status | 439 → 250 → **251** | – → – | 1,040 → – | 1 → 1 | 10 → 12 |
| Q8.priority | summary: count by priority | 2,427 → 138 → **138** | – → – | 1,040 → – | 1 → 1 | 18 → 10 |
| Q8.orgs | summary: top 10 organizations by open requests | 897 → 943 → **944** | כן → כן | 1,728 → 11,952 | 1 → 1 | 22 → 40 |
| Q9.history | history of request 12345 | 9 → 9 → **9** | – → – | – → – | 1 → 1 | 0 → 0 |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 24 → 23 → **23** | – → – | – → – | 1 → 1 | 0 → 0 |

**Q7a בצורת prefix (27.10.2026, #54):** אחרי המעבר של `assignedTo` מהשוואה מדויקת ל־`LIKE 'x%'`, ה־Plan בפועל על 100,000 הפניות עבור `adi%` (3,043 פניות) הוא **Index Seek** על `IX_Requests_AssignedTo_CreatedAt` (טווח `AssignedTo > … AND < …`), בלי סריקה מלאה: ‏COUNT – ‏20 reads, דף 1 – ‏80 reads (תחילית יכולה לכסות כמה מטפלים, ולכן ה־Id־ים התואמים ממוינים לפי `CreatedAt` לפני ה־OFFSET). בדיקה חד־פעמית של הצורה החדשה; הטבלה למעלה נשארת מדידת השוואה מדויקת.

ההשוואות המלאות (עם האינדקסים שכל שאילתה השתמשה בהם): [`final/compare-with-before.md`](performance/final/compare-with-before.md), [`after-indexes/compare-with-before.md`](performance/after-indexes/compare-with-before.md).

## נספח ב' – הקבצים

התוצאות הגולמיות של המסמך, כפי ש־`scripts/MeasureQueries.cs` כתב אותן, נמצאות ב־[`docs/performance/`](performance). המספרים הסופיים: [`final/`](performance/final) (Seeder v1), ואותו מצב על הנתונים שבהגשה – [`seed-v2-hebrew/`](performance/seed-v2-hebrew).

| תיקייה (`docs/performance/`) | תוכן | בסעיפים |
|---|---|---|
| [`before/`](performance/before) | בסיס: אינדקסי M1 דחוסים, ה־SQL של M2 | §1, §4, §5, נספח א' |
| [`after-indexes/`](performance/after-indexes) | אינדקסי M8 עם ה־SQL של M2 – ההשפעה של האינדקסים לבד | §5.3, נספח א' |
| [`final/`](performance/final) | המצב הסופי: האינדקסים וה־SQL של היום (Seeder v1); ההשוואה [`final/compare-with-before.md`](performance/final/compare-with-before.md) | §1, §4, §5.3, נספח א' |
| [`alternatives/`](performance/alternatives) | חלופות השאילתה שנבחנו (A1–A6), כולל החיפוש ב־`UPPER` והשוואה בינארית | §6.2, §7.1 |
| [`seed-v2-hebrew/`](performance/seed-v2-hebrew) | המצב הסופי על Seeder v2 (עברית), ‏[`compare-with-seed-v1-english.md`](performance/seed-v2-hebrew/compare-with-seed-v1-english.md) ו־[`gate-g3.md`](performance/seed-v2-hebrew/gate-g3.md) | §9 |

בכל תיקייה:
- `results.md` – טבלת כל השאילתות (logical reads, ‏Sort, ‏Memory Grant, ‏DOP, זמנים), גודל האינדקסים ועצי ה־Plans בטקסט.
- `compare-with-*.md` – השוואה לריצה אחרת, עם האינדקסים שכל שאילתה השתמשה בהם.
- `results.json` – הנתונים הגולמיים, לשימוש `--compare`.
- `plans/*.sqlplan` – ה־Execution Plans בפועל, נפתחים ב־SSMS: רק ב־`before/`, ‏`final/` ו־`alternatives/`. ב־`after-indexes/` וב־`seed-v2-hebrew/` עצי ה־Plans נשארו בטקסט בתוך `results.md`.

**הרצה חוזרת:**
```
cd be
dotnet run --project src/RequestsManagement.API -- seed --reset
dotnet run scripts/MeasureQueries.cs -- --out <dir> --label final
dotnet run scripts/MeasureQueries.cs -- --out <dir> --label before --shape original   (על אינדקסי M1: Migration קודם)
dotnet run scripts/MeasureQueries.cs -- --out <dir> --compare before final
```

(‏`--compare` מקבל שמות תיקיות יחסית ל־`--out`.)
