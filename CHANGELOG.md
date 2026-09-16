# Changelog

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
