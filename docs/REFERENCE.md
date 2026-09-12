# Socratic Reader Reference Analysis

Reference project: [FourteenObsidians/socratic-reader](https://github.com/FourteenObsidians/socratic-reader), reviewed at commit `4fb85a96f551400c4af0ef8dab3f800105e9b547`.

## Ideas worth adapting

- Anchor questions to specific source material instead of asking vague questions.
- Increase hints gradually and explain directly only when requested.
- Carry observed learning gaps into a cross-session review queue.
- Keep generated knowledge maps, annotations, and review records local.
- Treat reading, guided study, review, and open exploration as distinct states.
- Keep configuration and model requests in the local server so the browser does not hold credentials directly.

## How Inkleaf differs

The reference project centers on PDFs and fixed page numbers. Inkleaf is designed first for EPUB and other reflowable documents:

- locations use CFI, chapter hrefs, and text fingerprints;
- fiction receives reading-progress boundaries and spoiler-safe retrieval;
- notes behave like movable, linkable sticky notes rather than a linear text file;
- every book has an independent, portable notebook;
- translations, source passages, reader notes, and AI conversations remain traceable to one another.

Inkleaf adapts product concepts and public behavior descriptions; it does not copy the reference project's source code.
