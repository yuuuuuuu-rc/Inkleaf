# Local Notes and Evidence Model

## Principles

- A library remains portable and does not depend on a cloud database.
- Each book has an independent notebook so one damaged file cannot affect every book.
- Human-readable JSON remains the source of truth. A future SQLite index must be disposable and rebuildable.
- Reader notes remain reader-controlled. AI study notes are separate, automatically revised, and retain revision history.

## Canonical library layout

```text
library/
├─ library.json
├─ books/
│  └─ *.epub
└─ notes/
   └─ <book-id>/
      └─ notebook.json
```

## Proposed notebook schema

The notebook proposal below concerns reader-visible data. Since 0.5.0, internal AI data lives separately in `notes/<book-id>/.ai/text.json` and `memory.json`. The latter stores a fingerprint, status, section summaries, cumulative overview/reading plan, progress, errors, and the last 30 revisions. Writes use an atomic rename; per-book conversation queues prevent lost updates. Preparation saves a checkpoint after each section. Status APIs expose progress only, never note contents.

```json
{
  "version": 3,
  "bookId": "content-hash",
  "location": "epubcfi(...) ",
  "annotations": [],
  "notes": [],
  "translations": [],
  "conversations": [],
  "weakPoints": [],
  "links": [],
  "updatedAt": 0
}
```

Each note should contain:

- `id`, creation time, and modification time;
- `kind`: sticky note, question, claim, counterexample, excerpt, or review card;
- `body`: reader-editable rich-text blocks;
- `anchor`: CFI, chapter href, and text fingerprint;
- `author`: `reader`, `ai-draft`, or `coauthored`;
- `evidence`: book passages or external sources;
- `history`: reversible revisions.

## AI write protocol

For reader-visible notes, the proposed workflow is:

1. The AI returns a structured note proposal.
2. The interface previews the title, body, location, and sources.
3. The reader approves, edits, or rejects the proposal.
4. The server writes atomically and preserves the previous revision.
5. The interface offers undo.

Model and search credentials must never enter the library, exported notes, or Git history.

## Legacy migration

Inkleaf recognizes the directory names used by early local preview builds. On first access it:

1. renames the legacy book and note directories to `books/` and `notes/`;
2. writes a normalized `library.json` with portable forward-slash paths;
3. stores the original manifest as `library.legacy-backup.json`;
4. removes the obsolete manifest only after the new index is written successfully.
