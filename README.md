# FOSD · CEUC301 Course Website

Updated for the supplied 2026–27 FOSD syllabus and laboratory manual.

- 9 syllabus units with topic-wise PDF placeholders.
- 15 laboratory practical sessions following the supplied laboratory-manual structure.
- GeeksforGeeks removed from online learning resources.
- Existing question bank and course-resource folders retained.

## Adding lecture PDFs

Upload PDFs under `files/notes/` using the exact filename shown by each topic link.

## GitHub Pages

Publish from `main` branch and `/ (root)`.

## Adding MCQ practice questions

Add questions to `data/mcqs.json` as JSON objects with these fields:

- `id`: unique question ID across the complete file.
- `unitId` and `unitTitle`: a number from 1 to 9 and its matching FOSD syllabus title.
- `topic`, `difficulty` (`Easy`, `Medium`, or `Hard`), and `type` (`single_select`).
- `question`: question text.
- `options`: exactly four objects, each with a globally unique `id` and a `text` value.
- `correctOptionId`: the ID of exactly one option above; do not use its array position.
- `explanation`, optional `hint`, `tags` (an array of strings), and optional `source`.

The practice page fetches and validates this JSON at runtime. Use double-quoted JSON strings and property names, and do not add comments or trailing commas. The existing questions are original self-practice material, not official GATE previous-year questions. Scores exist only in page memory, are cleared on reload, and are not submitted or used as official marks.

## GoatCounter analytics and visitor statistics

The GoatCounter tracking script is included once in each public standalone HTML page. The home page uses GoatCounter's documented `visit_count()` integration with the `TOTAL` path to display cumulative page views; this embeds GoatCounter's public counter rather than making a browser-side JSON request, so it does not require an administrative API token or cross-origin JSON access. Counts start when this integration is deployed and may take up to four hours to refresh. Daily visits and popular-page statistics are not displayed.

To allow the total to appear, enable **Allow adding visitor counts on your website** in the GoatCounter site settings. This setting is off by default. Until it is enabled, GoatCounter may refuse to serve the public counter; the home page displays a configuration message instead of a fabricated count. The integration starts sending this site's page views when deployed; the displayed total is read from GoatCounter and may take up to four hours to refresh.

For local layout testing, serve the project over HTTP (for example, `python -m http.server 8000`) and open `http://localhost:8000/`. GoatCounter may ignore localhost traffic, and its public count endpoint requires the hosted site origin and public-count setting. After deploying to GitHub Pages and enabling that setting, open the home page and confirm the real total replaces the status message.
