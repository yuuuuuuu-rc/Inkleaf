# AI Collaborative Reading: Product Design

## Product goal

Inkleaf is not a chatbot placed beside an ebook. It is a reading companion constrained by the source text, the reader's progress, and the reader's own notes. Its purpose is to help readers form judgments rather than replace reading with summaries.

## Five core problems

### 1. Keep AI grounded in the text

Every answer should include a location that can return the reader to its source. Page numbers work for PDFs, but EPUB layout changes with fonts, windows, and devices. Inkleaf therefore uses:

- EPUB CFI for precise locations;
- chapter hrefs for structural locations;
- leading and trailing text fingerprints for recovery;
- a content hash for book-version identity.

The interface must distinguish source claims, reader interpretation, and AI inference.

### 2. Promote thinking instead of answering too quickly

The default coaching rhythm asks one answerable question at a time:

1. Point to a specific passage.
2. Ask for a testable explanation, prediction, or comparison.
3. Give a first-level hint based on the gap in the response.
4. Lower the abstraction level or introduce a counterexample when needed.
5. Give a complete explanation only when the reader asks for it.
6. End with a verification question that checks whether understanding was rebuilt.

Readers may switch to direct explanation at any time, but the application should never silently turn coaching mode into generic answer generation.

### 3. Control context and spoilers

By default, the AI sees only the current selection, reader-approved notes, and material up to the current reading position. Retrieval uses explicit boundaries:

- `current-chapter`: search only the current chapter;
- `read-so-far`: search only completed material;
- `whole-book`: search the entire book after explicit permission;
- `external-no-spoiler`: exclude plot summaries and later events from web research.

### 4. Turn notes into durable memory

The AI never silently overwrites a reader's notes. It may propose a note that the reader can approve, revise, or reject. Confirmed notes retain provenance, source anchors, and edit history, so future conversations can distinguish reader writing, AI drafts, and jointly edited conclusions.

### 5. Build meaningful connections across books

Cross-book links should describe a relationship rather than only report vector similarity. Supported relations include agreement, contradiction, analogy, prerequisite, shared entity, and conflicting terminology. Every link must return to a specific passage in each book.

## Proposed reading-agent state machine

```text
Select a passage
  -> classify intent: understand / verify / critique / translate / capture
  -> retrieve book evidence first
  -> request permission for web research when needed
  -> produce one anchored question or explanation
  -> record the reader's response and learning gaps
  -> propose a sticky note or review card
  -> write locally only after reader confirmation
```

## Priority milestones

1. Add explicit Socratic, direct-explanation, and critical-reading modes.
2. Attach source anchors to every AI response.
3. Add read-only retrieval over the reader's local notes.
4. Add controlled web search with separate book and web evidence.
5. Add cross-book links and a review queue.
