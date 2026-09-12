# Controlled Web Search Design

## Decision

Inkleaf should offer web search as an evidence tool, not as an unrestricted default capability. It is most useful for:

- historical context, allusions, people, and places;
- checking claims in nonfiction that may be outdated;
- locating author interviews, primary research, datasets, and errata;
- comparing translations and tracing terminology;
- following debate that occurred after publication.

Fiction should never trigger plot-related searches automatically because search results often reveal spoilers.

## Modes

- **Off:** search only the book and local notes.
- **Ask before searching (default):** explain why outside evidence is needed and preview the proposed query.
- **Automatic with spoiler protection:** search background facts and time-sensitive claims, but still request confirmation for plot, character fate, and later chapters.

## Tool boundary

The local server calls the search provider. The model cannot browse arbitrary URLs or access the file system. A request uses a constrained contract:

```json
{
  "query": "minimal search query",
  "intent": "background | verify | primary-source | translation",
  "bookId": "current book ID",
  "anchor": "current chapter or CFI",
  "spoilerBoundary": "read-so-far",
  "privacy": "query-only"
}
```

By default, Inkleaf sends only a minimal query—not a complete chapter, a long passage, or private notes.

## Evidence presentation

Answers use two visibly separate evidence lanes:

- **Book evidence:** title, chapter, CFI, and a short excerpt.
- **Web evidence:** page title, publisher, publication date, URL, and access time.

External sources must not silently redefine the author's argument. The AI should state whether a source adds context, verifies a fact, or challenges a claim.

## Implementation direction

The first implementation should use a provider adapter rather than bind search to one model vendor. OpenAI-compatible models, Gemini-compatible models, and local models can then consume one normalized result format.

Implementation order:

1. Search-provider adapter.
2. Page extraction and source deduplication.
3. Trust and freshness ranking.
4. Primary-source preference.
5. Search logs stored with the conversation while credentials remain in local configuration.

The first release should not offer unrestricted browser automation or let a model download files, sign in, post content, or modify external data.
