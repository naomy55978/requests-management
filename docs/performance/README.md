# תוצאות המדידות – מדריך

התיקייה מכילה את התוצאות הגולמיות של [PERFORMANCE.md](../PERFORMANCE.md): טבלאות, השוואות ו־Execution Plans, כפי שהכלי `scripts/MeasureQueries.cs` (ב־Repo של ה־Backend) כתב אותם. הניתוח והמסקנות – ב־PERFORMANCE.md; כאן רק הראיות.

## איפה המספרים הסופיים

- **[`final/`](final)** – המצב הסופי: האינדקסים וה־SQL של היום (Seeder v1). כל ההשוואות "לפני ← אחרי" במסמך הן `before` ← `final`. ההשוואה המלאה: [`final/compare-with-before.md`](final/compare-with-before.md).
- **[`seed-v2-hebrew/`](seed-v2-hebrew)** – אותו מצב סופי על הנתונים שבהגשה (Seeder v2, עברית), ושער הקבלה G3: [`seed-v2-hebrew/gate-g3.md`](seed-v2-hebrew/gate-g3.md).

## התיקיות

| תיקייה | מה יש בה | ב־PERFORMANCE.md |
|---|---|---|
| [`final/`](final) | המצב הסופי (Seeder v1) | §1 תקציר, §4 Plans, §5.3 התוצאה הכוללת, נספח א' |
| [`seed-v2-hebrew/`](seed-v2-hebrew) | המצב הסופי על Seeder v2 (עברית), ‏`gate-g3.md` | §10 גרסאות Seeder |
| [`before/`](before) | בסיס: אינדקסי M1 דחוסים, ה־SQL של M2 | §4 Plans, §5, נספח א' |
| [`after-indexes/`](after-indexes) | אינדקסי M8 עם ה־SQL של M2 – ההשפעה של האינדקסים לבד | §5.3, נספח א' |
| [`alternatives/`](alternatives) | חלופות השאילתה שנבחנו (A1–A6), כולל החיפוש ב־`UPPER` והשוואה בינארית | §6.2, §7.1 |
| [`archive/`](archive) | חומר ביניים – ראו למטה | |

### הארכיון (`archive/`)

מדידות ביניים שנשמרו כתיעוד. המסקנות שלהן כבר מסוכמות ב־PERFORMANCE.md, ואין צורך לפתוח אותן כדי לקרוא את התוצאות הסופיות.

| תיקייה | מה יש בה | ב־PERFORMANCE.md |
|---|---|---|
| [`archive/before-fragmented/`](archive/before-fragmented) | מדידת הבסיס הראשונה, על אינדקסים מפוצלים אחרי ה־Seed | §3 (ממצא מתודולוגי) |
| [`archive/experiments/`](archive/experiments) | 13 ניסויי אינדקסים (כיבוי אינדקס קיים, הוספת מועמד), כל אחד מול `before`; בלי Plans | §5 |
| [`archive/seed-v1-english/`](archive/seed-v1-english) | מדידה חוזרת של המצב הסופי לפני החלפת הנתונים, הבסיס להשוואה v1 ← v2 | §10 |

## מה יש בכל תיקייה

- `results.md` – טבלת כל השאילתות (logical reads, ‏Sort, ‏Memory Grant, ‏DOP, זמנים), גודל האינדקסים ועצי ה־Plans בטקסט.
- `compare-with-*.md` – השוואה לריצה אחרת, עם האינדקסים שכל שאילתה השתמשה בהם.
- `results.json` – הנתונים הגולמיים, לשימוש `--compare`.
- `plans/*.sqlplan` – ה־Execution Plans בפועל; נפתחים ב־SSMS.

שמות הריצות בכותרות הקבצים (למשל `Measurement 'experiments/with-Title'`) הם השמות כפי שנמדדו, לפני ההעברה לארכיון.
