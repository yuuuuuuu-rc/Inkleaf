# Inkleaf

**A local-first EPUB reader for AI-assisted reading, translation and interactive notes.**

[简体中文](README.zh-CN.md) · [Product design](docs/PRODUCT.md) · [Web-search design](docs/WEB_SEARCH.md)

Inkleaf keeps books, highlights, sticky notes, translations, reading positions and AI conversations in a library folder you choose. It runs as a local web app and listens only on `127.0.0.1`.

## Highlights

- Import and manage EPUB books in a portable local library.
- Highlight text and create interactive, book-specific sticky notes.
- Translate selections through an OpenAI-compatible API.
- Discuss the current passage and your notes with an AI reading companion.
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
├─ 墨页书库.json
├─ 书籍/
│  └─ *.epub
└─ 笔记/
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

Only passages and context submitted to an AI action are sent to the configured provider. Inkleaf does not upload the complete library in the background.

## Local data and privacy

| Data | Location |
|---|---|
| Books, notes, translations and conversations | The library folder you choose |
| API configuration | `%LOCALAPPDATA%\Inkleaf\settings.json` |
| Application source | This repository |

Do not commit API keys, copyrighted books or personal notes. The included `.gitignore` excludes common local data and ebook formats. See [SECURITY.md](SECURITY.md) for the security model.

## Updating

Stop the local server, then update and start it again:

```powershell
git pull --ff-only
npm test
npm start
```

Updating the source does not move or rewrite the selected library.

## Troubleshooting

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

### My old 墨页阅读 settings are missing

Inkleaf automatically reads the previous `%LOCALAPPDATA%\墨页阅读网页\settings.json` location when the new configuration has not been created yet. Saving Settings migrates the configuration to the Inkleaf folder.

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

Web search is intentionally not enabled by default. The planned design searches the book and local notes first, requests permission before external research, separates book evidence from web evidence and enforces spoiler boundaries.

## License

[MIT](LICENSE). Bundled open-source libraries retain their original licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
