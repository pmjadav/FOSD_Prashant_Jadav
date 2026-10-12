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
