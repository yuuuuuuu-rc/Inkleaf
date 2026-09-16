# Inkleaf

**A local-first EPUB reader for AI-assisted reading, translation and interactive notes.**

[Product design](docs/PRODUCT.md) · [Data model](docs/DATA_MODEL.md) · [Web-search design](docs/WEB_SEARCH.md)

Inkleaf keeps books, highlights, sticky notes, translations, reading positions and AI conversations in a library folder you choose. It runs as a local web app and listens only on `127.0.0.1`.

## Highlights

- Import and manage EPUB books in a portable local library.
- Highlight text and create interactive, book-specific sticky notes.
- Translate selections through an OpenAI-compatible API.
- Discuss the current passage and your notes with an AI reading companion.
- Pre-read an entire EPUB into private, evolving AI study notes and a reading plan.
- Let the companion verify public facts with Gemini Google Search and return sources.
- Preserve reflowable-document locations with EPUB CFI-style anchors.
- Keep API credentials outside the repository and outside the book library.
- Run with Node.js built-ins only: no `npm install`, database or cloud account required.

## Requirements

- Windows 10 or Windows 11
- [Node.js](https://nodejs.org/) 18 or newer
- Microsoft Edge or another modern browser
- Optional: an OpenAI-compatible model API for translation and AI reading

Windows is currently the supported desktop platform because library, import and export dialogs use Windows system dialogs. The local server and automated smoke test also run on Linux, but the complete desktop workflow is not yet cross-platform.

## Quick start

### Option 1: double-click on Windows

1. Download or clone this repository.
2. Double-click `start-windows.cmd`.
3. In Inkleaf, choose a library folder.
4. Import an EPUB and start reading.

### Option 2: terminal

```powershell
git clone https://github.com/yuuuuuuu-rc/Inkleaf.git
cd Inkleaf
npm start
```

Inkleaf opens at <http://127.0.0.1:43128>.

## First-time setup

### 1. Choose a library

Use **Choose library folder** on the first screen. Inkleaf creates this structure without changing EPUB files outside it:

```text
Your library/
├─ library.json
├─ books/
│  └─ *.epub
└─ notes/
   └─ <book-id>/
      └─ notebook.json
```

Back up the whole library folder to preserve books and notes together.

### 2. Configure AI features

Open **Settings** in Inkleaf and enter:

- **Base URL** — for example `https://api.openai.com/v1`, or an OpenAI-compatible endpoint.
- **API key** — stored only in the current Windows user's local configuration.
- **Model** — the model name supported by the selected provider.
- **Target language** — used for translation and AI responses.

For Gemini's OpenAI-compatible API, `https://generativelanguage.googleapis.com/v1beta` is accepted and Inkleaf adds the compatibility route automatically.

Translation sends the selected text. Whole-book pre-reading sends all extractable text of the book you choose to your configured provider, in sections. Inkleaf does not upload other books in the background.

### 3. Prepare an AI reading companion

Open a book, choose **AI Reading**, then **Pre-read whole book**. The server reads every text section in order, creates section summaries, and maintains a cumulative book map and clarification plan. Wait for **Whole-book preparation complete** before sending questions. Large books take longer and consume more API tokens.

You can keep reading while preparation runs, or select **Pause** (effective after the current section). After an interruption, **Resume pre-reading** continues from the last saved section. Closing the browser does not stop the local server's job; stopping the server does.

In conversation, the companion consults relevant original passages and revises its own study notes after answering. These notes never appear as reader sticky notes or in note exports. The last 30 internal revisions are retained locally. If updating the notes fails, the answer remains available with a warning.

**Allow web search when needed** is enabled initially and can be turned off. It currently requires a direct Gemini connection and a model that supports Google Search grounding. The AI chooses when an external fact needs checking and sends a short query, then returns source URLs. Search can incur additional provider charges; unsupported models or temporary search failures are reported instead of treated as verified evidence.

Preparation covers extractable EPUB text, including appendix sections. Image-only text requires OCR, which is not included. The current limit is 15 million text characters per book.

## Local data and privacy

| Data | Location |
|---|---|
| Books, notes, translations and conversations | The library folder you choose |
| Internal AI notes, revision history and extracted text | `notes/<book-id>/.ai/` inside that library |
| API configuration | `%LOCALAPPDATA%\Inkleaf\settings.json` |
| Application source | This repository |

Do not commit API keys, copyrighted books or personal notes. The included `.gitignore` excludes common local data and ebook formats. See [SECURITY.md](SECURITY.md) for the security model.

Internal AI notes are hidden from the reading interface and normal notebook API, not encrypted or inaccessible to the computer owner. They are ordinary study summaries, not a model's private chain of thought.

## Updating

Stop the local server, then update and start it again:

```powershell
git pull --ff-only
npm test
npm start
```

Updating the source does not move or rewrite the selected library.

## Troubleshooting

### Web search reports quota exceeded

Gemini text generation and Google Search grounding may have different quotas. An API key that translates successfully can still have no remaining search quota. Check your Google AI Studio project's quota and billing, then try again; Inkleaf does not change your plan or silently switch models. You can turn search off and continue book-grounded conversations. Failed searches are explicitly marked, and only URLs returned by the search provider are accepted as external source links.

### The window does not open

Run `node --version`. Install Node.js 18 or newer if the command is missing or reports an older version. Then run `npm start` from the repository folder to see the startup error.

### The page is blank

Open <http://127.0.0.1:43128> directly and refresh once. Then run `npm test`; it checks the server, HTML entry point, browser bridge and empty-library response without touching your real library.

### Port 43128 is already in use

Start Inkleaf on another port:

```powershell
$env:INKLEAF_PORT=43129
npm start
```

### My settings from an earlier preview are missing

Inkleaf automatically detects settings from earlier local preview versions when the new configuration has not been created yet. Saving Settings migrates the configuration to `%LOCALAPPDATA%\Inkleaf\settings.json`.

## Development

The local server uses Node.js built-ins and serves the checked-in `dist/` assets.

```powershell
npm run check
npm test
```

The smoke test uses a temporary configuration directory and never opens or modifies a real book library. Pull requests run the same checks on Windows and Linux.

## Product direction

- [AI collaborative-reading design](docs/PRODUCT.md)
- [Local notes and evidence model](docs/DATA_MODEL.md)
- [Controlled web-search tool design](docs/WEB_SEARCH.md)
- [Socratic Reader reference analysis](docs/REFERENCE.md)

The current companion consults the book before optional external research. Its instructions distinguish book evidence from web evidence and avoid spoilers unless requested; this is a prompt-based preference, not a guaranteed spoiler filter.

## License

[MIT](LICENSE). Bundled open-source libraries retain their original licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
