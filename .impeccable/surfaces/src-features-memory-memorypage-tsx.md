---
version: 1
slug: "src-features-memory-memorypage-tsx"
primary_target: "src/features/memory/MemoryPage.tsx"
related_targets: ["src/app/sections.tsx"]
---

# Memory page

Scope: the Memory section, `src/features/memory/MemoryPage.tsx` (not built yet). Mode: Operate.
Plan: `docs/dev/plans/2026-10-31-memory-page.md`. Mock-ups: `.impeccable/mocks/memory/`.

Audience and job: the owner, a few times a week, after agents worked. Sees what agents concluded about them and their
contacts, checks each against its sources, and confirms, corrects or forgets it. Real content: Memo's memories and
facts (a handful to a few hundred), each with 1–10 source refs.

Inherits the patch-rack world (DESIGN.md); no new tokens or components.

## Direction contract

THESIS: memory as a dated ledger in one rack, every entry with its lamp and its evidence under the row; refuses the
card grid of "AI memories" and the list-plus-detail split.
OWN-WORLD: green-tinted wall, one hairline rack, day headings in ink-dim, amber lamp = waits for you, green = kept,
grey ring = no longer holds; agent names, refs and times in mono; Confirm outlined, Forget outlined danger.
STORY: the owner sees how many entries wait, opens one, reads the quoted sources and who wrote it, and confirms or
corrects it; nothing an agent writes counts until then.
FIRST VIEWPORT: Unbounded "Memory" with one paragraph; filter row (Waiting for you · Kept · No longer hold · All with
counts, About, Written by); the rack with Today's first waiting row already open on its sources.
FORM: structure 4 of 7 on the ranked list (the ledger), seed key 71abbb70, code-led (no comps).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
