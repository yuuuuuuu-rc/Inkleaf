# Changelog

## 0.6.0 - 2026-09-19

- Added locally bundled PDF.js rendering, PDF import, page navigation, zoom and text-layer selection alongside the existing EPUB reader.
- Reused sticky notes, persistent source highlights, manual translation and whole-book AI preparation for PDFs.
- Added a persistent top-bar auto-translation switch, initially off, so selecting passages for notes does not automatically call AI.
- Preserved existing EPUB books and notebooks; image-only PDFs have an explicit no-OCR notice.

## 0.5.0 - 2026-09-16

- Added full EPUB text pre-reading with checkpoints, pause/resume and a private cumulative book map and reading plan.
- Added evidence retrieval and conversation-driven updates to internal AI notes, with 30 local revisions.
- Added optional Gemini Google Search grounding and external source URLs, with explicit unavailable-search reporting.
- Kept internal notes separate from reader notebooks, note exports and public progress responses.
- Added a pre-reading panel and corrected stale JavaScript caching on updates.

## 0.4.2 — 2026-09-16

- Added automatic retries for temporary AI provider failures, including HTTP 503 responses.
- Normalized `Chinese` translation targets to `Simplified Chinese`.
- Strengthened the translation prompt for faithful, terminology-consistent output without invented context.
- Prevented an older translation from appearing when a newly selected passage fails to translate.

## 0.4.1 — 2026-09-12

- Standardized the public project, application messages, and interface in English.
- Standardized new libraries as `library.json`, `books/`, and `notes/`.
- Added an automatic, backed-up migration for libraries created by early preview builds.
- Renamed local configuration and product-facing metadata to Inkleaf.

## 0.4.0 — 2026-09-10

- Established Inkleaf as a standalone local Git project.
- Added EPUB library management, book-specific notebooks, translation and AI reading conversations.
- Added a zero-dependency local server and Windows launcher.
- Added bilingual setup, privacy, security, contribution and troubleshooting documentation.
- Added cross-platform syntax and smoke checks through GitHub Actions.
