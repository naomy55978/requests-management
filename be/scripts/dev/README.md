# כלי פיתוח אופציונליים

הסקריפטים בתיקייה הזו הם **כלי פיתוח אופציונליים**. הם שימשו לאימות כל שלב מול ה־API הרץ ומסד של 100,000 פניות, בזמן הפיתוח. לא צריך אותם כדי לבנות, להריץ או לבדוק את הפרויקט, וה־CI לא מריץ אותם.

**הבדיקות האוטומטיות (`dotnet test`, ‏`tests/RequestsManagement.Tests`) הן מקור האמת.** הן מכסות את אותם תרחישים: שליפה, עדכון סטטוס, Bulk, Cache ו־Concurrency (‏`ConcurrencyTests`).

| סקריפט | מה הוא בודק |
|---|---|
| `verify-read-api.js` | שליפה: סינון, חיפוש, מיון ודפדוף מול SQL ישיר, Validation, ‏Summary, ‏OpenAPI, זמני תגובה |
| `verify-status-update.js` | עדכון סטטוס: כל המעברים, ‏404/409/422/400/401/415, היסטוריה |
| `verify-bulk-status.js` | עדכון מרוכז: ולידציה, כל התוצאות, ריצה במקביל ל־PATCH |
| `verify-summary-cache.js` | Cache של ה־summary, כולל פקיעה אמיתית אחרי 60 שנ' |
| `ConcurrencyProof.cs` | אין Lost Update: ‏20 בקשות PATCH במקביל לכל אחת מ־50 פניות |

הפעלה מתיקיית השורש של ה־Repo, למשל `node scripts/dev/verify-read-api.js` או `dotnet run scripts/dev/ConcurrencyProof.cs`. דרישות, משתני סביבה ואיפוס הנתונים – בפרק "סקריפטי אימות" ב־[README](../../README.md) הראשי.

כלי מדידת השאילתות `scripts/MeasureQueries.cs` נשאר בתיקייה `scripts/`: הוא מקור התוצאות שב־`docs/PERFORMANCE.md`.
