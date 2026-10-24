# מערכת לניהול פניות – Frontend

צד הלקוח של מערכת ניהול הפניות: אפליקציית Angular 22 עם Angular Material, בעברית ועם פריסת RTL, שעובדת מול ה־REST API של ה־Backend.

> התכנון, ההחלטות וה־Issues נמצאים ב־[requests-management-docs](https://github.com/naomy55978/requests-management-docs) – נקודת הכניסה לפרויקט. ה־Backend נמצא ב־[requests-management-be](https://github.com/naomy55978/requests-management-be).

## דרישות

- **Node.js** בגרסה `^22.22.3` או `^24.15.0` (כך ש־Angular 22 דורש). בפרויקט יש `.nvmrc` עם הערך `24`. Node 20 לא מספיק.
- ה־**Backend** חייב לרוץ על `http://localhost:5084` (ראו את ה־README של [requests-management-be](https://github.com/naomy55978/requests-management-be)).

## הרצה

```bash
npm ci
npm start
```

האפליקציה תהיה זמינה ב־http://localhost:4200.

### ה־Proxy

שרת הפיתוח מעביר כל בקשה ל־`/api/...` אל ה־API (`proxy.conf.json`, ברירת מחדל: `http://localhost:5084`). מבחינת הדפדפן הכול מגיע מאותו Origin, ולכן אין צורך ב־CORS בצד השרת. אם ה־API רץ בכתובת אחרת – יש לשנות את `target` בקובץ `proxy.conf.json`.

אם ה־API לא רץ, האפליקציה תציג הודעה "אין חיבור לשרת" עם כפתור "נסה שוב".

## בדיקות ואיכות קוד

```bash
npm test -- --watch=false   # בדיקות יחידה (Vitest)
npm run lint                # ESLint (angular-eslint)
npm run build               # בנייה לפרודקשן (dist/)
```

ה־CI ב־GitHub Actions מריץ את שלושתם על כל Push (`.github/workflows/ci.yml`, Node 24).

## מבנה הקוד

```
src/app/
  core/       שירותים ללא תצוגה: גישה ל־API, התחברות, תרגום תוויות והודעות שגיאה
  shared/     רכיבי תצוגה קטנים לשימוש חוזר
  features/   המסכים
```

כל Component מחולק לשלושה קבצים נפרדים (`*.component.ts`, ‏`*.component.html`, ‏`*.component.scss`) – אין template או styles Inline, וה־Lint אוכף זאת.
