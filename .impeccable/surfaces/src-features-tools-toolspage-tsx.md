---
version: 1
slug: "src-features-tools-toolspage-tsx"
primary_target: "src/features/tools/ToolsPage.tsx"
related_targets: ["src/app/App.tsx"]
---

# Surface: Tools (main window)

Scope: the WireCat Desktop main window, Tools section. Mode: Operate.

Audience and job: someone who wants WireCat tools working without npm sees which tools exist, what is installed,
and installs or updates one; an existing CLI user checks versions and health.

## Direction contract

THESIS: the machine as a patch rack. Each tool is one module row: status lamp, icon, name and command, installed
version, one action. Refuses the card grid and the sidebar-plus-detail split.

OWN-WORLD: WireCat brand. Green-tinted wall, one white rack panel with hairline row dividers, round status lamps
(green ready, amber update, hollow missing, purple pulsing busy), mono versions, purple primary actions only where
something can be installed. Unbounded for the page title, Onest for everything else.

STORY: see readiness first, scan six rows, act on the one that is not green, watch it verify inline.

FIRST VIEWPORT: sidebar with logo, Tools, Storage, Accounts and Memory (Soon), version and theme switch; window controls
top right; "Your computer" lamps; Tools heading; the rack with all six rows; an install opens a four-step panel
under its row.

FORM: patch rack, rank 4 of 7, seed 0a4cd1d6, approved comp .impeccable/mocks/decision/rack.png.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Stated deviations from the comp (approved by the owner 2026-10-25: "1 A")

1. While a tool installs, its action is Cancel, not Install; the version column keeps the installed state.
2. Rows carry the real catalog descriptions, not the comp's placeholder lines, and real states (Memo shows its
   update, not a placeholder "Fix").
3. "Check again" beside the heading: detection must be re-runnable after the user installs Node.js by hand.
4. Storage section, uninstall and the delete-data offer: owner request, 2026-10-25, quoted: "we need to allow
   uninstall … also allow clearing storage somehow, mb inside another menu or smth".
5. Theme switch in the sidebar footer: owner request, quoted: "add dark/light themes and other important ui things
   from start".
6. Rows show a short tagline from the catalog; the full summary is in the Manage panel (finish review fix 1).
