# Security

Inkleaf is a single-user local application. The server binds to `127.0.0.1` by design and has no account system.

## Safe use

- Do not expose the server to a LAN or the public internet.
- Never commit settings, API keys, books or personal notes.
- Only install releases or run code from a source you trust.
- Back up your chosen library folder; it contains all books and notebooks.

Only text intentionally submitted to an AI feature is sent to the configured model provider. Books and notebooks are otherwise read from and written to local storage.

Whole-book pre-reading explicitly sends all extractable text of the selected book to the configured AI provider. Internal summaries and relevant reader context are used in later API conversations. Optional Gemini Google Search sends an AI-selected public-fact query to Google. Search results and book text are treated as reference material, not executable instructions.

Internal study notes are stored in `notes/<book-id>/.ai/` and are not returned by the regular notebook or progress endpoints. They are not encrypted; the computer owner and software with filesystem access can read them. Model instructions discourage verbatim disclosure but are not an access-control boundary. The AI can revise its own study notes, not overwrite the reader's sticky notes.

## Reporting a vulnerability

Open a GitHub security advisory for vulnerabilities that could expose local files, API keys or notes. Do not include real keys, copyrighted books or personal notebook data in reports.
