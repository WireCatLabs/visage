# Bug report API

The contract between WireCat Desktop (the client, `src-tauri/src/report.rs`) and `WireCatLabs/wirecat-api` (the
server). Change it here first, then on both sides.

Base URL: `https://api.wirecat.dev`. The desktop app reads `WIRECAT_API_URL` to point at a local server
(`http://localhost:3000`).

## Principles

- **The public issue never carries logs.** It holds the user's text, the app and tool versions, the OS and the
  report id. Logs go to private storage on the server and are linked from nowhere public.
- **The client masks first, the server masks again.** Everything the desktop sends has been through `redact.rs`.
  The server runs its own pass before storing, because a client bug must not become a leak.
- **No accounts, no keys in the app.** A desktop app cannot keep a secret, so the endpoint is public and protected
  by size limits, a per-IP rate limit and schema validation.
- **Retries are safe.** Each report carries an `Idempotency-Key`; the same key returns the same report.

## `POST /v1/reports`

Headers:

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |
| `Idempotency-Key` | a UUID v4, created once per report on the client and reused on retry |
| `User-Agent` | `WireCatDesktop/<version> (<os>; <arch>)` |

Body, at most 1 MB:

```json
{
  "report": {
    "summary": "Install of Google Drive fails with EACCES",
    "details": "### What I was doing\n\n1. Opened Tools …\n\n### What happened\n\nThe install stopped …",
    "expected": "What the user expected instead, or null.",
    "tool": "drive",
    "app": { "name": "wirecat-desktop", "version": "0.1.0" },
    "system": { "os": "Linux", "arch": "x86_64", "node": "24.19.0", "npm": "11.6.2" },
    "tools": [{ "id": "tg", "version": "0.88.0", "manager": "pnpm" }],
    "attachments": { "runs": [{ "tool": "tg", "runs": [{}] }], "installLog": ["npm ERR! …"] }
  }
}
```

| Field | Rules |
| --- | --- |
| `summary` | required, 1–120 characters, becomes the issue title |
| `details` | required, 1–10 000 characters. Markdown: the desktop form is a template, and its answers arrive as a `### What I was doing` section (left out when empty) and a `### What happened` section. Render it as given |
| `expected` | optional, up to 5 000 characters |
| `tool` | optional, one of `tg max wa zm drive memo`, or null for the app itself |
| `app`, `system`, `tools` | required objects; versions may be null when unknown |
| `attachments` | optional object; **private**, stored on the server only, never copied into the issue. The desktop app always sends `runs` (each installed tool's last 20 failed runs, from its `runs list`), plus `installLog` (the masked output of a failed install, up to 200 lines) when a failed install opened the report. A body over 1 MB loses `runs` first. Store it as given; new keys may appear |

Responses:

| Status | Body | Meaning |
| --- | --- | --- |
| `201` | `{"report": {"id": "…", "issue": {"number": 12, "url": "https://github.com/…/issues/12"}}}` | stored, issue created |
| `202` | `{"report": {"id": "…", "issue": null}}` | stored; the issue will be created later (GitHub unavailable) |
| `200` | as `201` or `202` | the same `Idempotency-Key` was seen before |
| `413` | error | body over 1 MB |
| `422` | error with `fields` | validation failed |
| `429` | error, `Retry-After` header | rate limited |

Error body: `{"error": {"code": "validation_error", "message": "…", "fields": {"summary": ["is too long"]}}}`. The
client shows `message` and, when present, the field messages next to the fields.

## Issue body

The desktop app previews the public issue and opens the same text on GitHub when the server cannot be reached
(`issueBody` in `src/domain/report.ts`). The server renders the issue in the same order:

1. `details` as given (the template's sections).
2. `### Expected` with `expected`, only when present.
3. `### Environment`: `- App: <name> <version>`, `- OS: <os> <arch>`, `- Node: <node>, npm: <npm>` (`not found` when
   null), `- Tool: <tool>` when set, then `- <id> <version> (<manager>)` for each installed tool.
4. The report id, in small text.

## Health

`GET /up` answers `200` when the process runs. `GET /v1/health` reports the database and other dependencies and
answers `503` when one of them is down.
