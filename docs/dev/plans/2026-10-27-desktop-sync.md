# Sync from Desktop

Owner, 2026-10-27: "enable sync from desktop app for a cli with a button and show last synced, progress there as well".
Journal: TASK-33. Rule 1 holds: the app runs each tool's own sync command and reads its own answers.

## What each tool offers today

Read from the code on each repository's `main` (cli-core 0.463.0); nothing was synced to find this out.

| Tool | Sync command | Profile | While it runs | Last synced | Stop | Two at once |
| --- | --- | --- | --- | --- | --- | --- |
| tg, max | `<p> messages sync --all` (cli-core `backfill-command.ts`): every chat, newest first, the last 90 days, a capped number of messages per chat | first word | text notes on stderr, `N messages so far, back to <chat key>`; the summary only at the end | no whole-profile readout; `runs list` has the run only when it was started with `--record` (or failed) | SIGTERM: exit 143, no summary; each page is already kept, the next run continues | no lock; SQLite queues writes. max runs every command through its profile's `max serve` |
| wa | `--all` is refused: WhatsApp pushes chats, `wa <p> serve` is the sync | first word | — | — | — | one connection per linked device: a second engine fails `device.in-use` |
| drive | `<p> sync` (200 files a run) | first word | nothing; `N source operations remain` at the end | `<p> status --json` → `item.last_sync`, set only when nothing is pending; `item.pending` | SIGTERM between files: exit 130, done files kept | a per-profile lock: `profile.locked`, exit 12 |
| memo (notes and mail) | `memo sync` (every folder and account; `--only mail` for mail) | none; one store for all accounts | stderr lines per account, naming it | `memo mail status <account>`; `runs list` with `--record` | **ignores SIGINT and SIGTERM, and has no `--timeout`** (BUG-17): only a kill stops it; resume points are saved every 30 s | one global `import.lock`: `sync.running`, exit 8 |
| zm | `<p> meetings sync` (deadline 1 h) | first word | nothing | `<p> meetings status --json` → `item.updated_at` is when the last sync **started** (FIND-73) | SIGTERM: exit 143; pulled meetings kept, the cursor does not move | no lock |

Every sync prints one JSON envelope on stdout when it ends (`item`, `meta`), and an error envelope on stderr when it
fails (`error.code`, `error.reason`). Exit 9 is the time limit.

**The time limit (RISK-42, FIND-71).** Without `--timeout`, cli-core gives `messages sync` the 30-second default for any
command, so `--all` on max or a large tg dies at once. No work in flight changes this: the only budget work is cli-core
#2118, calendar sync only. The app passes `--timeout` in the catalog words, and the app's own limit is longer, so the
tool ends itself cleanly and keeps what it fetched. When the other agent's flag lands it replaces these words.

## What the app does

The catalog gets a `sync` block per tool, read by Rust and TypeScript:

```json
"sync": {
  "run": ["{profile}", "messages", "sync", "--all", "--timeout", "2h", "--record", "--json"],
  "last": ["{profile}", "runs", "list", "command:\"messages sync\" status:success", "--limit", "20", "--json"],
  "lastShape": "runs",
  "perProfile": true
}
```

`--record` keeps the app's own successful runs in the tool's run log, so `runs list` answers "last synced" today; runs
from a terminal join when cli-core #2119 (record every run) ships. Its tests show an app run (`WIRECAT_CALLER=desktop`)
keeps a success only with the flag, which the app passes; not yet seen on a real successful sync (NEED-118). drive reads
`status` (`lastShape: "driveStatus"`), every other tool `runs list`, including zm, whose `meetings status` time is the
last start. With no time the line says "No sync recorded from this app yet", never "never synced".

- **Rust (`sync.rs`)**: `sync_run(id, profile)` runs the catalog's words for a profile the owner chose
  (`run::stream_stoppable`, like sign-in), `sync_stop(id, profile)` sends SIGTERM to that process alone, then kills its
  group after the grace; `sync_last(id, profile)` reads the time. One sync per package and profile (memo: per package),
  and none while the package installs, updates or uninstalls. Only counts and stage names leave Rust: the notes' chat
  keys, account names and titles in `items[]` stay behind (rule 4); an error passes through `redact.rs`.
- **Interface**: in Manage, one line per profile: **Sync now**, **Last synced 12 min ago**; while it runs a bar
  (indeterminate, the count of messages so far when the tool says it), the stage, the elapsed time and **Stop**. The
  result stays until dismissed: "Synced 1,240 new messages in 3 chats", with the next step: search, sync again for what
  is left, or the fix for an error. On the Tools row, a tool with one profile gets the same compact line under its name;
  more profiles show the one running, or the newest time.
- **wa**: no button. The line says WhatsApp brings messages in while `wa <profile> serve` runs (FIND-72).

## Gaps

| Gap | Where it is fixed | State |
| --- | --- | --- |
| memo ignores Stop and has no time limit (BUG-17) | cli-memo: read the signal, stop between batches, honour `--timeout` | done: cli-memo #487, released 0.118.0 |
| No structured progress in `messages sync` (DEBT-4) | cli-core #2121: `{"event":"progress","step":"sync","chats","chats_done","fetched"}` on stderr | PR green, queued on #849; then tg/max/wa bumps (another lane). Desktop already reads it |
| No progress in drive, zm or memo syncs | their own sync code (#2121 covers only `messages sync`) | not started |
| An error message may name a chat (RISK-44) | Desktop: show only code and reason, point to the failed run on Logs | open |
| No whole-profile "last synced" for messengers | cli-core #2119 records every run; until then only syncs the app started | waits on #2119 |
| zm's status time is the last start | zm `meetings status` could add `finished_at` | proposed |
| wa has no one-shot sync | product decision (NEED in the journal) | open |

## Mocks

`?sync=<tool>` starts that tool's sync for `personal`; `?sync-fail=<tool>` makes it fail; `?sync-timeout=<tool>` ends it
at the time limit; `?sync=never` shows profiles that were never synced.
