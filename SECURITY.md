# Security

Inkleaf is a single-user local application. The server binds to `127.0.0.1` by design and has no account system.

## Safe use

- Do not expose the server to a LAN or the public internet.
- Never commit settings, API keys, books or personal notes.
- Only install releases or run code from a source you trust.
- Back up your chosen library folder; it contains all books and notebooks.

Only text intentionally submitted to an AI feature is sent to the configured model provider. Books and notebooks are otherwise read from and written to local storage.

## Reporting a vulnerability

Open a GitHub security advisory for vulnerabilities that could expose local files, API keys or notes. Do not include real keys, copyrighted books or personal notebook data in reports.
