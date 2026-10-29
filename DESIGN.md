---
name: WireCat Desktop
description: The machine as a patch rack. A calm control window onto the WireCat CLI tools.
colors:
  light-wall: "#f1f4f2"
  light-app: "#ffffff"
  light-app-2: "#f6f8f7"
  light-app-3: "#e5ece7"
  light-line: "#d6dfd9"
  light-line-strong: "#ccd7cf"
  light-ink: "#182822"
  light-ink-soft: "#4c5e55"
  light-ink-dim: "#63746a"
  light-brand: "#4b53f0"
  light-brand-hover: "#3a42dc"
  light-brand-soft: "#e8e9fd"
  light-ok: "#1f9a55"
  light-warn: "#d08a12"
  light-warn-ink: "#8a5a00"
  light-bad: "#cf4a2f"
  light-idle: "#a9b5ae"
  light-on-status: "#ffffff"
  brand-ink: "#ffffff"
  dark-wall: "#131718"
  dark-app: "#181c1e"
  dark-app-2: "#1c2023"
  dark-app-3: "#23292c"
  dark-line: "#262c30"
  dark-line-strong: "#2f373b"
  dark-ink: "#e9eeec"
  dark-ink-soft: "#a7b1ae"
  dark-ink-dim: "#87928e"
  dark-brand: "#6b72ff"
  dark-brand-hover: "#8187ff"
  dark-brand-soft: "#262a52"
  dark-ok: "#5cc98a"
  dark-warn: "#e6b04a"
  dark-warn-ink: "#e6b04a"
  dark-bad: "#f07a5f"
  dark-idle: "#4c5659"
  dark-on-status: "#0d1512"
typography:
  display:
    fontFamily: '"Unbounded Variable", "Unbounded", system-ui, sans-serif'
    fontSize: "2.1rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Onest Variable", "Onest", system-ui, sans-serif'
    fontSize: "1.2rem"
    fontWeight: 600
  title:
    fontFamily: '"Onest Variable", "Onest", system-ui, sans-serif'
    fontSize: "1.08rem"
    fontWeight: 600
    lineHeight: 1.25
  nav:
    fontFamily: '"Onest Variable", "Onest", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
  body:
    fontFamily: '"Onest Variable", "Onest", system-ui, sans-serif'
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: '"Onest Variable", "Onest", system-ui, sans-serif'
    fontSize: "0.9rem"
    fontWeight: 500
  button:
    fontFamily: '"Onest Variable", "Onest", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 500
  mono-value:
    fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Menlo, monospace'
    fontSize: "1.02rem"
    fontWeight: 400
    fontFeature: '"tnum"'
  mono-small:
    fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Menlo, monospace'
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  rack: "0.2rem"
  pill: "0.3rem"
  control: "0.35rem"
  button: "0.4rem"
  inset: "0.45rem"
  dialog: "0.6rem"
  full: "9999px"
spacing:
  page-gutter: "2.1rem"
  page-top: "1.6rem"
  page-bottom: "2.2rem"
  page-stack: "1.5rem"
  row-inset: "1.3rem"
  row-gap: "0.9rem"
  row-gap-xl: "1.2rem"
  sidebar-inset: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.light-brand}"
    textColor: "{colors.brand-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    height: "2.4rem"
    padding: "0 1.1rem"
  button-primary-hover:
    backgroundColor: "{colors.light-brand-hover}"
  button-secondary:
    backgroundColor: "{colors.light-app}"
    textColor: "{colors.light-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    height: "2.4rem"
    padding: "0 1.1rem"
  button-secondary-hover:
    backgroundColor: "{colors.light-app-2}"
  button-ghost:
    textColor: "{colors.light-ink-soft}"
    rounded: "{rounded.button}"
  button-ghost-hover:
    backgroundColor: "{colors.light-app-3}"
    textColor: "{colors.light-ink}"
  button-danger:
    backgroundColor: "{colors.light-app}"
    textColor: "{colors.light-bad}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    height: "2.4rem"
  button-sm:
    rounded: "{rounded.control}"
    height: "2rem"
    padding: "0 0.75rem"
  rack:
    backgroundColor: "{colors.light-app}"
    rounded: "{rounded.rack}"
  rack-row:
    padding: "0 1.3rem"
    height: "4.5rem"
  row-panel:
    backgroundColor: "{colors.light-app-2}"
    padding: "1.4rem 1.3rem"
  lamp:
    rounded: "{rounded.full}"
    size: "1.4rem"
  lamp-sm:
    rounded: "{rounded.full}"
    size: "0.85rem"
  pill-neutral:
    backgroundColor: "{colors.light-app-3}"
    textColor: "{colors.light-ink-soft}"
    rounded: "{rounded.pill}"
    padding: "0.1rem 0.45rem"
  pill-brand:
    backgroundColor: "{colors.light-brand-soft}"
    textColor: "{colors.light-brand}"
    rounded: "{rounded.pill}"
    padding: "0.1rem 0.45rem"
  input:
    backgroundColor: "{colors.light-app}"
    textColor: "{colors.light-ink}"
    typography: "{typography.mono-small}"
    rounded: "{rounded.control}"
    height: "2rem"
    padding: "0 0.625rem"
  copy-field:
    backgroundColor: "{colors.light-app-2}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.button}"
  segmented:
    backgroundColor: "{colors.light-app-3}"
    rounded: "{rounded.inset}"
    padding: "3px"
  segmented-selected:
    backgroundColor: "{colors.light-app}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.control}"
    size: "1.75rem"
  dialog:
    backgroundColor: "{colors.light-app}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.dialog}"
    padding: "1.5rem"
    width: "min(32rem, calc(100vw - 2rem))"
  nav-item:
    textColor: "{colors.light-ink-soft}"
    typography: "{typography.nav}"
    height: "2.6rem"
    padding: "0 1.5rem"
  nav-item-active:
    textColor: "{colors.light-ink}"
---

# Design System: WireCat Desktop

## Overview

**Creative North Star: "The Patch Rack"**

The machine is a patch rack. Each tool is one module row: a status lamp, an icon, the name and command, the installed version, and one action. The window shows readiness first, the user scans six rows, acts on the one that is not green, and watches it verify inline under its row. The design refuses the card grid and the sidebar-plus-detail split.

The world is the WireCat brand from wirecat.dev, made into a desktop tool. A green-tinted wall carries one white rack panel with hairline row dividers. Round lamps carry state. Versions, commands and paths are set in mono, because they are what the machine reports. Purple is the brand and the "do something" colour, so it appears on the logo, the active section marker, text links and at most one primary action per row. Unbounded is the page title and nothing else; Onest does the rest.

The interface scales with the window, as a native app's content does on different displays: the root font size is fluid and every size is in rem. The surface is flat and quiet. Depth exists only where something floats above the page (a dialog) or is picked out of a group (the selected theme option).

These words come from the surface's direction contract ([the Tools surface brief](.impeccable/surfaces/src-features-tools-toolspage-tsx.md)); they were not re-confirmed with the owner for this file.

**Key Characteristics:**

- One flat rack panel per page: hairline frame, 0.2rem corners, no shadow, rows split by hairlines.
- Five lamp tones carry all tool and system state.
- Mono with tabular figures for every machine-reported value.
- Purple is rare and always means brand, link or the one primary action.
- Unbounded only for page titles; Onest for everything else.
- Light and dark themes share one set of semantic tokens; the whole surface switches together.

## Colors

Green-tinted neutrals with one purple, plus a small status set; each token has a light and a dark value, bound through CSS variables on `:root` and `:root[data-theme="dark"]` in [src/styles/index.css](src/styles/index.css).

### Primary

- **WireCat Purple** (`light-brand`, `dark-brand`): the logo disc, the active section bar and icon, text links (Show log, Technical details, Documentation, GitHub), the busy lamp, the stepper's active and completed track, the focus outline, and the primary button. Dark mode uses a lighter purple so it holds against charcoal.
- **Pressed Purple** (`light-brand-hover`, `dark-brand-hover`): hover for primary buttons and text links.
- **Purple Wash** (`light-brand-soft`, `dark-brand-soft`): background of brand pills ("runs first", "signed in").
- **On Purple** (`brand-ink`): text on the primary button, white in both themes.

### Status

- **Ready Green** (`ok`): ready lamp, done step, success icons.
- **Update Amber** (`warn`): update lamp, warning icons, and tint fills (the Node notice banner at 10%, the warn pill at 15%).
- **Amber Ink** (`warn-ink`): any amber text (a leftover-data status, a shadowed-copy note, the warn pill's label). In light mode it is a dark amber; in dark mode it equals `warn`.
- **Fault Red** (`bad`): broken lamp, failed step, error text, the danger button's label, error banners (40% border, 10% fill).
- **Idle Grey** (`idle`): the hollow ring of a missing or checking lamp, and pending stepper dots.
- **On Status** (`on-status`): the check or cross inside a done or failed stepper dot; white in light mode, near-black in dark mode, where the status colours are light.

### Neutral

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `wall` | `light-wall` | `dark-wall` | Window ground, sidebar |
| `app` | `light-app` | `dark-app` | The rack, dialogs, inputs, secondary buttons |
| `app-2` | `light-app-2` | `dark-app-2` | Row panels (at 60%), copy fields, raw output |
| `app-3` | `light-app-3` | `dark-app-3` | Ghost hover, neutral pills, segmented track, skeleton |
| `line` | `light-line` | `dark-line` | Row dividers, panel tops, sidebar and top-bar edges |
| `line-strong` | `light-line-strong` | `dark-line-strong` | The rack frame, button and input borders, scrollbars |
| `ink` | `light-ink` | `dark-ink` | Titles, versions, primary text |
| `ink-soft` | `light-ink-soft` | `dark-ink-soft` | Taglines, commands beside names, body prose |
| `ink-dim` | `light-ink-dim` | `dark-ink-dim` | Sub-headings in panels, app version, placeholders, "Check again" |

### Relation to wirecat.dev

The app follows the site's purple, wall, ink and `app-3` values exactly in light mode. It deviates on purpose in these places:

- **Dark purple** is `#6b72ff`, not the site's `#4b53f0`.
- **Dark surfaces are lifted**: `app` is `#181c1e` (the site's is `#0d0f10`), so the rack sits a step above the wall instead of sinking below it.
- **Two line weights** (`line`, `line-strong`) where the site has one `app-line`. `line-strong` in light mode is the site's `app-line`.
- **Text links are purple.** The site keeps content links in ink; in the app a link is always an action, so it takes the action colour.
- **Status colours** (`ok`, `warn`, `warn-ink`, `bad`, `idle`) are the app's own; the site's DESIGN.md does not record them.

### Named Rules

**The Amber Ink Rule.** `warn` is for lamps, icons and tint fills; any amber text uses `warn-ink`. Light-mode `warn` is too pale to read as text on white.

**The One Purple Action Rule.** A rack row and the panel open under it carry at most one primary (filled purple) button: Install, Update to x, or the panel's Done. Manage, Fix and Cancel are outlined. Dialogs have no primary at all; they pair a ghost "Keep it" with an outlined danger action.

**The Semantic Theme Rule.** Bind every colour through the semantic tokens (`bg-app`, `text-ink-soft`, `border-line`); never a raw hex in a component, so both themes switch together.

## Typography

**Display Font:** Unbounded Variable (fallback Unbounded, system-ui)
**Body Font:** Onest Variable (fallback Onest, system-ui)
**Label/Mono Font:** JetBrains Mono Variable (fallback JetBrains Mono, ui-monospace, Menlo)

**Character:** A wide, heavy display face says "WireCat" once per page; a plain, friendly sans carries the interface; mono marks everything the machine itself reports.

### Hierarchy

- **Display**: the page title (Tools, Storage, the error screen) and nothing else. Extra-bold, tight tracking, line-height 1.
- **Headline**: dialog titles.
- **Title**: the tool name in a rack row; it turns purple when the row is hovered. The command sits beside it in mono at 0.95rem in `ink-soft`.
- **Nav**: sidebar sections; regular, semibold when current.
- **Body**: taglines, notices, panel prose; relaxed line-height, prose capped at 70ch.
- **Label**: small panel sub-headings ("Install from a terminal", "Installed at", "Profiles") in `ink-dim`, sentence case, never uppercase.
- **Button**: medium weight, 1rem (0.875rem in the small size).
- **Mono value**: installed versions, readiness values, byte counts. Tabular figures so columns line up.
- **Mono small**: install paths, folder lists, the raw log, the profile-name input.

### Named Rules

**The Display-Once Rule.** Unbounded appears only in the page `h1`. Row names, dialog titles and section labels stay in Onest.

**The Mono Truth Rule.** A value the machine reports (version, command, path, size, OS) is set in JetBrains Mono with tabular figures; words the app writes are set in Onest.

## Layout

The window is a fixed shell: a sidebar on the `wall` (12rem, 13.5rem from the `xl` breakpoint at 1280px), and a content column with a 3.3rem top bar (window controls, drag region), a 3.9rem "Your computer" readiness strip, and a scrolling page. The body never scrolls; only the page region does. The default window is 1280×840 and the minimum is 960×640 ([src-tauri/tauri.conf.json](src-tauri/tauri.conf.json)).

The root font size is fluid, `clamp(13px, 0.5rem + 0.52vw, 18px)`: about 14.7px in the default 1280 window, 13px at the 960 minimum. Body text (0.95rem) is then about 14px at 1280 and captions and labels (0.9rem) about 13px. The owner first asked for a denser interface, then found the smallest text too hard to read: the root grew from 12.5px to 13.4px with the two smallest steps moved up (captions and labels 0.85rem → 0.9rem, mono small and pills 0.8rem → 0.85rem), and on 2026-10-27, when that was not visibly different, to 14.7px. Nothing in the app is set below 0.85rem except the uppercase group heading in a Select (0.8rem). Every size in the app is in rem, so the whole interface grows and shrinks with the window like native content, and all spacing tokens above scale with it. The clamp is multiplied by `--ui-scale`, the owner's own interface size: Settings → Interface size, 80% to 150% in 10% steps, or Ctrl (Cmd on macOS) with `+`, `-` and `0` anywhere. It is kept in `localStorage` (`wirecat.scale`, beside the theme) and set before the first paint by `index.html`. A new size grows over 200ms (instant under reduced motion) while the focused control, or else what is at the top of the page, stays where it was; the slider applies on release, so it does not grow under the pointer while it is dragged.

A page is a vertical stack with a 1.5rem gap and a 2.1rem side gutter: title row (title left, a quiet secondary action right, bottom-aligned), then any notice banners, then the rack. The rack row is a five-column grid: lamp, icon, name and tagline (flexible), version, action. The fixed columns widen and the gap grows from 0.9rem to 1.2rem at `xl`. Rows are at least 4.5rem tall. The Storage rack uses the same frame with four columns (icon, name and folders, size, action).

A row expands in place: the panel under it opens by animating grid rows from 0fr to 1fr over 300ms with the quart ease-out. The details panel becomes two columns from `lg` (1024px), about and links on the left, profiles and health on the right.

## Elevation & Depth

The system is flat. Structure comes from the wall-to-panel tonal step, hairline borders, and the `app-2` wash on expanded panels. The shadow token exists for two things only: the selected thumb of the theme segmented control, and dialogs. Neither the rack, nor rows, nor banners, nor buttons cast a shadow.

### Shadow Vocabulary

- **Panel** (`--shadow`, light `0 1px 2px rgb(24 40 34 / 6%), 0 8px 24px rgb(24 40 34 / 5%)`; dark uses black at 30% and 25%): dialogs, and the selected segmented option.

The busy lamp's pulse animates a purple ring with `box-shadow`; that is motion, not elevation.

### Named Rules

**The Flat Rack Rule.** The rack is a hairline frame (`line-strong`, 0.2rem corners) on the wall, with no shadow. Only something that floats over the page or is lifted out of a group gets the panel shadow.

## Shapes

Corners are nearly square and grow slightly with how "detached" an element is: the rack and banners at 0.2rem, pills at 0.3rem, small controls and inputs at 0.35rem, regular buttons and copy fields at 0.4rem, inner containers (profile list, health result, segmented track) at 0.45rem, dialogs at 0.6rem. Lamps and stepper dots are full circles; the sidebar's active marker is a 4px bar rounded on its outer side. Borders are 1px hairlines; the idle lamp is a 1.5px inset ring. Nothing uses the site's 999px pill controls.

## Components

### Buttons

- **Shape:** gently squared (0.4rem; 0.35rem in the small size), 1px border, 2.4rem tall (2rem small).
- **Primary:** filled purple with white text. Used for Install, Update to x, Get Node.js, and Done after an operation.
- **Secondary:** white surface, `line-strong` border; hover moves to `app-2`. Used for Manage, Cancel, Try again, Check health. The row action keeps a minimum width of 7.6rem so the column stays steady between states.
- **Ghost:** no fill, `ink-soft`; hover fills `app-3`. Used for Keep it, Close, Check, Sign in.
- **Danger:** outlined only: white surface, red label, the border tints red on hover. Used for Fix, Uninstall, Delete.
- **Hover / Focus:** colour transitions at 150ms with the quart ease-out; pressing nudges the button down 1px. Focus is the global 2px purple outline at 2px offset. Disabled buttons drop to 45% opacity and stop taking pointer events.

### Status Lamp (signature)

A round lamp, 1.4rem in rows and 0.85rem in the readiness strip, with exactly five tones: `ok` solid green (installed and current), `warn` solid amber (update available), `bad` solid red (installed but does not start), `idle` hollow grey ring (missing or still checking), `busy` solid purple with a 1.4s pulse (installing or uninstalling). A lamp with meaning carries an accessible label ("Update available"). Tone changes cross-fade over 300ms.

### Rack Row (signature)

Lamp, line icon (2rem, 2.4rem at `xl`), name with its command in mono, a one-line truncated tagline, the version in mono (or "Not installed" in `ink-soft`, "Does not start" in red), and one action. The whole name block is a button that opens the details panel. While a tool installs, the action becomes Cancel and the version column keeps the installed state; the progress shows in a four-step stepper panel under the row.

### Stepper

Four steps joined by a 2px track. Done is a green dot with a check, active is a pulsing purple dot, failed is red with a cross, pending is a small grey dot. The track fills purple behind completed steps over 500ms. The active label is semibold.

### Chips (Pills)

- **Style:** small (0.85rem, medium weight), 0.3rem corners, no border.
- **Variants:** neutral (`app-3` / `ink-soft`, for "Soon" and "not signed in"), brand (`brand-soft` / `brand`, for "runs first" and "signed in"), warn (amber at 15% / `warn-ink`, for "not used").

### Cards / Containers

- **The rack:** `app` fill, `line-strong` frame, 0.2rem corners, rows divided by `line`. One per page.
- **Row panels:** open under a row with a `line` top border and `app-2` at 60%; 1.3rem side inset.
- **Banners:** 0.2rem corners, 1px border at 40% and fill at 10% of `warn` (notice) or `bad` (error), placed between the title row and the rack.
- **Inner containers:** profile list and health result use 0.45rem corners, a `line` border and `app` fill inside the `app-2` panel.

### Inputs / Fields

- **Style:** 2rem tall, `app` fill, `line-strong` border, 0.35rem corners, mono text with an Onest placeholder in `ink-dim`.
- **Error:** the border turns red and a one-line red hint appears below.
- **Copy field:** a command in mono on `app-2` with a `line` border and an icon button that swaps to a green check for 1.6s.

### Navigation

Sidebar sections on the wall: a line icon (1.55rem, stroke 1.6) and label. Current: semibold `ink`, purple icon, and a 4px purple bar on the left edge that scales in. Other: `ink-soft`, hover to `ink`. Sections that are not built yet stay visible, dimmed, with a neutral "Soon" pill. The footer holds the app version and the light / system / dark segmented control.

### Dialogs

The platform's modal dialog: `app` fill, `line` border, 0.6rem corners, the panel shadow, a 40% black backdrop with a 1px blur, max 32rem wide. A semibold title, body prose in `ink-soft`, actions right-aligned with the safe choice (ghost, focused first) left of the destructive one.

### Motion

One easing, `cubic-bezier(0.25, 1, 0.5, 1)` (quart out). 150ms for hover and press, 300ms for lamp tone and panel expand, 500ms for the stepper track. Loading uses a shimmer skeleton (1.6s). Every animation and transition collapses to near zero under reduced motion.

Rule 9 (CLAUDE.md) uses five shared pieces, never ad hoc CSS:

- **`Collapse`** (`src/ui/Collapse.tsx`): anything that opens and closes in place (a row's panel, a section, a disclosure, a guide's step). Grid rows 0fr → 1fr over 300ms; closing content stays until it has folded away, then unmounts.
- **`AutoHeight`** (`src/ui/AutoHeight.tsx`): content that swaps for taller or shorter content (a guide's step, an install that becomes the tool's details). Its height follows the content over 300ms.
- **`Crossfade`** (`src/ui/Crossfade.tsx`): one view that replaces another in the same place (the selected agent's pane). The old view stays mounted, inert and out of the flow, and fades out over the new one in 200ms, so the area never goes blank; wrap it in `AutoHeight` for the height. Instant under reduced motion.
- **`.step-in`** for the new step of a multi-step flow, **`.reveal`** for content that replaces a placeholder; dialogs rise in over 200ms and fade out over 150ms.
- **`src/ui/motion.ts`**: `focusInPlace` moves focus without scrolling and scrolls, smoothly, only to what is off screen; `holdInPlace` keeps a clicked row where it is while panels around it open and close; both keep the page's room when content shrinks, so the scroll is never clamped to the top.

## Do's and Don'ts

### Do:

- **Do** put a tool, a storage area or any list of machine things in the rack: one flat panel, one row per thing, hairlines between rows.
- **Do** give every row exactly one action, and make it primary only when it installs or updates something.
- **Do** say state with the five lamp tones and plain words beside them, never with colour alone.
- **Do** set versions, commands, paths and sizes in mono with tabular figures.
- **Do** write sizes in rem so they follow the fluid root size.
- **Do** let content select with the mouse (text, logs, paths, errors) and keep chrome from selecting: buttons, labels, tabs, menus, the title bar and sidebar (`@layer base` in `index.css`). Text inside a `<button>` can never be selected in WebKit, so a clickable row whose text is worth copying is a `div role="button"` that ignores the click ending a drag (`selectsTextIn`). `.selectable` lets content inside chrome select. Write every `user-select` with its `-webkit-` twin: WebKitGTK reads only that, and the dev server does not add it.
- **Do** use `warn-ink` for amber text and `warn` for lamps, icons and tints.

### Don't:

- **Don't** turn the rack into a card grid or a sidebar-plus-detail split; details open under their row. One
  exception, the owner's choice (2026-10-25): the Agents page is a list of agents beside one agent's pane, because it
  is about one agent at a time and everything about that agent (its skills, what else stops it, its sessions, its
  tasks) belongs in one place. Below about 52rem of page width the two stack.
- **Don't** add a shadow to the rack, a row, a banner or a button. The panel shadow belongs to dialogs and the selected segmented option.
- **Don't** use Unbounded below the page title.
- **Don't** fill a button red. Danger actions are outlined; the only red fill is the window close control on hover.
- **Don't** put two purple buttons in one row or one dialog.
- **Don't** nest cards, add gradients, or add decoration that does no work (a WireCat brand commitment in [PRODUCT.md](PRODUCT.md)).
- **Don't** use uppercase labels or kickers; labels are sentence case in `ink-dim`.

<!-- cspell:words Onest -->
