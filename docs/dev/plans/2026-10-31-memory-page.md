# The Memory page

Owner, 2026-10-31: "ok let's build memory, prepare a plan, use impeccable for design". Memory goes first among the later
sections (NEED-164), and the Accounts placeholder goes while Memory stays (NEED-165). Journal: TASK-45.

This round is the plan and the design. Nothing is built in the app yet.

## Why

Agents connected to Memo save what they learn about the owner and the people the owner talks to: "Kai prefers Friday
calls", "we moved the launch to March". Memo keeps each one with its sources and marks it `proposed` until the owner
confirms it. Today the owner can review these only in a terminal (`memo memories list status:proposed`). The page puts
the review where the owner already is. The owner sees what agents remember, the evidence for each entry, and who wrote
it, and the owner confirms, corrects or forgets it.

The point is trust: nothing an agent concludes about a person counts until the owner has seen it.

## What Memo offers today

Read from the installed `memo` 0.124.0 (`memo commands --json`, `memo commands info <path> --json`, `--help`) and from
cli-memo's `main` (2b547a5). The checks ran read-only commands with `--no-record`. No sign-in, no writes.

| Part of the page | Command | Fields it returns | Status |
| --- | --- | --- | --- |
| Memories | `memo memories list [status:… kind:… scope:… subject:…] --limit 500 --json` | `ref`, `id`, `kind` (summary, digest, preference), `text`, `subject` (`person:<id>` or null), `author {type: person\|bot, id, name}`, `model`, `confidence`, `status` (proposed, confirmed, stale, superseded), `scope` (personal, work), `supersedes`, `evidence` (array of refs: `msg:…`, `note:…`, `document:…`, `meeting:…`), `last_verified_at`, `created_at`, `updated_at` | exists |
| Facts | `memo facts list [kind:… status:… project:… subject:…] --limit 500 --json` | `ref`, `id`, `kind` (fact, statement, question, decision, promise), `text`, `status` (proposed, accepted, superseded, reversed), `project`, `subject`, `occurred_at`, `supersedes`, `author`, `model`, `confirmed_by`, `scope`, `origin` (owner, agent), `evidence`, `created_at`, `updated_at` | exists |
| Confirm | `memo memories confirm memory:<id>`, `memo facts confirm fact:<id>` | the record, with its new status | exists |
| No longer true | `memo memories invalidate memory:<id>` (status → `stale`); `memo facts reverse fact:<id>` (accepted decisions only) | the record | exists |
| One source, whole | `memo messages show <msg:…>`, `memo notes show <note:…\|document:…>` | message: `sender_name`, `timestamp`, `text`, `chat_id`…; note: `title`, `path`, `text`… | exists, one call per ref (0.23 s each, measured) |
| Correct | `memo memories add <text> --kind --scope --evidence … --supersedes memory:<id>` | the new memory; the old one becomes `superseded` | **CLI work**: the store takes `supersedes` (cli-core `store/sqlite/memories.js`), the command does not offer it |
| Forget | `memo memories remove memory:<id>`, `memo facts remove fact:<id>` | `{ ref, removed: true, links: <n> }` | **CLI work**: the store has `deleted_at` and every list hides deleted rows, but no command sets it |
| Reject a proposed fact | `memo facts reject fact:<id>` | the fact, status `rejected` | **CLI work**: a proposed fact can only be confirmed today; `reverse` refuses anything but an accepted decision |
| Who an entry is about | `subject_name` beside `subject` in `memories list` and `facts list` | `"Kai Sample"`, `"Project Harbour"`, `"You"` | **CLI work**: today only `person:2835`, and no command turns an id into a name without a full `memo context` |
| Sources in one answer | `memo memories show memory:<id> --sources`, the same on `facts show` | `sources[]`: `{ ref, kind, title or sender, at, excerpt, tool, missing }` | **CLI work**: saves one process per source and handles every ref kind, including a source deleted since |
| Who wrote it | `author.name` (`claude-code`, `hermes`, `memo-mcp`), `model` | in the lists above | exists |
| Agent activity | `memo agents list [agent:… tool:…] --json` | `id`, `actor {type, id, name}`, `tool`, `tier` (read, write), `target`, `status`, `error`, `started_at`, `finished_at`; never the arguments | exists, but it is one log shared by tg, max and memo, not a memory log (NEED-168) |
| People | `memo search people <name>` needs a name; there is no list | `ref`, `name`, `identities[]` | no list command; the page uses people only as a filter built from `subject_name` |
| Note folders, what is indexed | `memo folders list` (`id`, `path`, `format`), `memo store info` | — | exists, but folders belong to Memo's details on the Tools page and the store to the Storage page; this page does not repeat them |

Agent-written records start `proposed`; owner-written ones start `confirmed` or `accepted` (cli-memo
`src/memories/memories.ts:19`). Memo decides the author from `AI_AGENT` and `CLAUDECODE` (cli-memo `src/author.ts`).
The app already removes those variables from every command it runs (`src-tauri/src/run.rs`, `AGENT_ENV`), so an app
started from an agent's terminal still writes as the owner. The page does not pass `--as-owner`.

## What the page shows and does

The roll's structure, "the ledger", in the patch-rack world of [DESIGN.md](../../../DESIGN.md). The owner's choice
between it and the two other structures is NEED-167.

- **Title row.** "Memory", one paragraph on what this is ("Nothing an agent writes counts until you confirm it"), a link
  to Memo's [memories guide](https://github.com/WireCatLabs/cli-memo/blob/main/docs/memories.md), and "Read again".
- **Filters.** A text segmented control: Waiting for you · Kept · No longer hold · All, each with its count; the first
  carries a small amber lamp. Two selects: About (Everyone, You, then every `subject_name` in the list) and Written by
  (Anyone, You, every agent name). The page opens on Waiting for you when anything waits, else on Kept.
- **One rack.** Memories and facts together, newest first, grouped under quiet day headings (Today, Yesterday, 28 Oct).
  A row: lamp, icon (memory or fact), the text (two lines at most), a line with kind · about whom · by whom (agent
  names in mono), the time in mono, one action.
  - Lamps, with the word beside them: proposed → amber "Waits for you"; confirmed or accepted → green; stale,
    superseded, reversed, rejected → grey ring. Red only when a read failed.
  - The action is **Confirm**, outlined (DESIGN.md: purple is for install and update). A kept or past row shows its
    state word instead, so the column does not jump.
- **The row opens in place** (`Collapse`): left, "What it rests on": each source with its tool icon, sender or title,
  date in mono and the quoted line; a link "Search for Kai Sample" opens the Search page (PR #34) with the tool and
  `from:"Kai Sample"` filled in and the profile left for the owner to choose (rule 3). Right: written by, through
  what, saved when, kind and scope, state; then Correct, No longer true, Forget….
- **Correct** opens a text box under the details, filled with the current text. "Save correction" writes the owner's
  memory with `--supersedes`; the agent's version moves to No longer hold as "Replaced". Facts get the same through
  `facts add --supersedes` (it exists for facts).
- **Forget…** opens a dialog: ghost "Keep it" (focused) and outlined danger "Forget". It lists exactly what goes: the
  record with its ref and the first words of its text, and its N links to sources. It says the messages, notes and
  meetings themselves stay, and that Correct keeps a record of the mistake.
- **Rule 9.** Confirming a row under Waiting for you turns its lamp green in place; it leaves the filter only when the
  owner changes the filter or reads again. Correct and Forget keep the row where it is until their own animation ends.
  Counts update at once.
- **Footer line.** Where agent activity lives (NEED-168).

Mock-ups: [.impeccable/mocks/memory/](../../../.impeccable/mocks/memory/), made from a prototype that uses the app's own
components ([prototype/MemoryPage.tsx](../../../.impeccable/mocks/memory/prototype/MemoryPage.tsx), outside `src`, not
built).

| Screen | Light | Dark |
| --- | --- | --- |
| Waiting, one row open, 1280×840 | `desktop-light.png` | `desktop-dark.png` |
| The same at the 960×640 minimum | `narrow-light.png` | `narrow-dark.png` |
| Correct | — | `correct-dark.png` |
| Forget dialog | `forget-light.png` | — |
| Kept · empty · Memo missing · Memo too old · read failed | `state-kept-light.png`, `state-empty-light.png`, `state-missing-light.png`, `state-old-light.png`, `state-error-light.png` | `state-missing-dark.png` |

## Privacy

- **Rule 4.** Memories, facts and source lines are the owner's own data on the owner's own page, so they are shown
  unmasked, as the Search page does (`src-tauri/src/search.rs`, module comment). They never go into a log, a bug report
  or a crash report: the Rust commands return them to the page only, and `ReportThis` on this page sends the error
  reason, never the text.
- **`--no-record` on every call, reads and writes.** A desktop run is kept only when it fails
  ([record-every-run](2026-10-27-record-every-run.md)), and a failed `memories add` would keep the corrected text in
  Memo's run log. `--no-record` keeps it out.
- **Rule 5.** Forget deletes one record the owner picked, by its ref, through Memo's own command, after a dialog that
  lists everything that goes. No bulk forget in the first version, no pattern, no "forget everything about Kai".
- **Rule 3.** No profile is involved: Memo has one store. The Search link leaves the profile to the owner.
- **Rule 2.** Every action is a `#[tauri::command]` taking a validated ref (`^(memory|fact):\d+$`) and, for Correct,
  text (non-empty, at most 2,000 characters, no control characters). Rust maps it to a fixed `memo` command line.
- **Confirmed does not prove the owner.** An agent in a terminal can run `memo memories confirm` or pass `--as-owner`
  (Memo's own docs: "An agent can pass `--as-owner` too, so tell it not to"). The page shows `confirmed_by` where
  Memo gives it (facts) and says nothing stronger than Memo knows (RISK-57).

## States

| State | What the owner sees |
| --- | --- |
| Memo not installed | A quiet panel: Memory is kept by Memo; a "Go to Tools" button. No filters, no rack. |
| Memo too old | Read via `compat-store`, as the Search page does: the installed version lacks a command the page needs (`memories remove`, `--supersedes`, `subject_name`). "Update Memo" is the one primary button. An old Memo that can list but not write could get a read-only page; the first version does not (simpler). |
| Loading | Four skeleton rows inside the rack frame; the filters stay put. |
| Empty | "No memories yet", what an agent saves here, with an example; links to the Agents page to connect one. Per filter: "Nothing waits for you" under Waiting, with a link to Kept. |
| Read failed | `ErrorNotice` with Memo's reason (`store.busy`: another sync holds the store, try again) and Report this. |
| A source is gone | The source line says "deleted since" in `ink-dim`; the memory stays. |
| A write failed | The row keeps its state; an inline error under its actions names Memo's reason. |

## Mock scenarios for the browser build

`?memory=none` (empty), `?memory=missing` (Memo not installed), `?memory=old` (too old), `?memory-fail=read`
(store busy), `?memory-fail=write` (Confirm fails), `?memory=many` (300 entries across 40 days, for scrolling and
counts), `?memory=gone` (one source deleted since). The default mock has three waiting, two kept, one stale, with
made-up names only (Kai Sample, Ana Ruiz, Project Harbour).

## Build steps

Rule 1: the CLI work goes first, in cli-memo, and the app waits for its release.

| # | Step | Where | Estimate |
| --- | --- | --- | --- |
| 1 | `memories add --supersedes`, `memories remove`, `facts remove`, `facts reject`, with contract tests | cli-memo (+ cli-core store if `reject` needs a status) | 0.5–1 day |
| 2 | `subject_name` in `memories list` and `facts list` | cli-memo, cli-core store join | 2–3 h |
| 3 | `memories show --sources` / `facts show --sources`: every ref resolved, excerpt, `missing` | cli-memo | 0.5 day |
| 4 | Release memo; record the minimum version in the catalog | cli-memo release, `catalog/tools.json` | 1 h |
| 5 | Rust: `memory_list`, `memory_sources`, `memory_confirm`, `memory_stale`, `memory_correct`, `memory_forget`; ref and text validation; `--no-record`; tests with a fake `memo` | `src-tauri/src/memory.rs`, `lib.rs` | 0.5 day |
| 6 | Platform bridge, zod schemas, mock platform with the scenarios above | `src/platform/` | 3–4 h |
| 7 | Page: filters, rack with day groups, row, open panel, Correct, Forget dialog, every state; messages in en, ru, es | `src/features/memory/` | 1–1.5 days |
| 8 | Search link: open Search with tool and query filled | `src/features/search/` (after PR #34 merges) | 1–2 h |
| 9 | Checks: tests, both themes and 960 width with the capture script, rule 9 script, keyboard, reduced motion; `pnpm check` | — | 3–4 h |

About 4–5 working days in all, about one of them in cli-memo.

## Open questions for the owner

- **NEED-167 · Which arrangement should the Memory page take?** A the ledger (one rack, day groups, filter on top; drawn
  in the mock-ups) · B two racks, "Waiting for you" above "Kept" · C a query bar with facets, like Logs. I recommend
  **A**: one rack per page (DESIGN.md), and a confirmed row stays where it is (rule 9); B has to move it between
  racks, C is built for thousands of rows when the owner has a handful.
- **NEED-168 · Where should the agent activity log (`memo agents list`) appear?** A a section on the Memory page · B
  per agent on the Agents page · C only in Logs. I recommend **B**: the log covers tg and max calls too, not only
  memory, and the Agents page is already about one agent at a time.
- **NEED-169 · Should Forget delete a record, or only mark it "no longer true"?** A both: Forget (deleted, new
  `memo memories remove`) and No longer true (kept as stale) · B only No longer true, nothing is deleted. I recommend
  **A**: a wrong conclusion about a person should be removable, and Correct still keeps a trail when the owner wants one.
- **NEED-170 · Should agents' proposed actions (`memo actions`) and project or meeting findings wait on this page too?**
  A not in the first version · B yes, as more rows under "Waiting for you". I recommend **A**: approving an action
  makes a task, which belongs to a future Tasks page; the Memory page stays about what is remembered.
