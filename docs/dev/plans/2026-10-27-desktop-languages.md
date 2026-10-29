# WireCat Desktop in English, Russian and Spanish

The owner asked on 2026-10-27 to allow switching languages in Settings: Russian, Spanish and English. Russian and
Spanish ship in the first version (NEED-127 B). This plan covers the library, the message structure, dates and
numbers, the default language, and what stays in English.

## Library: typed catalogs and a small `t`, no i18n library

| Option | Size (min / gzip) | Plurals | Build step | Typed keys |
| --- | --- | --- | --- | --- |
| i18next 26.5 + react-i18next 17.1 | 70.1 kB / 24.3 kB | CLDR via `Intl.PluralRules`, `_one/_few/_many` keys | none | via declaration merging |
| Lingui 6.11 (`@lingui/core` + `@lingui/react`) | 9.2 kB / 4.0 kB | ICU MessageFormat | macro plugin, `lingui extract` and `compile` | message ids, not keys |
| In-house catalogs + `Intl.PluralRules` | under 1 kB | `Intl.PluralRules`, a form per category | none | the catalog's TypeScript type |

Sizes from the bundlephobia API (`https://bundlephobia.com/api/size?package=<name>`, read 2026-10-29).

The in-house one wins. The interface has three languages, no translators outside this repository, and no runtime
loading; what the libraries add (namespaces, lazy loading, ICU syntax, an extraction tool) is weight we would carry
and tooling we would maintain. TypeScript already gives what matters most: a key missing in Russian is a compile
error, and so is a slot passed with the wrong name.

Plurals use `Intl.PluralRules`. Node 24 and Chrome report the categories: English `one, other`; Russian
`one, few, many, other`; Spanish `one, many, other` (`many` is for round millions, "1 000 000 de mensajes"). A plural
message gives a form for each category its language has, and `other` is the fallback.

## Message structure

- One catalog per feature folder: `src/features/<area>/messages.ts`, plus `src/app/messages.ts` and
  `src/ui/messages.ts`. A feature's strings, its translations and its code change together, and parallel work on two
  features never touches the same file.
- Each catalog exports `en` (the source), then `ru` and `es` typed as `Catalog<typeof en>`, so the compiler checks
  that every key is there with the same slots.
- A value is a string, or a function for anything with a slot: `installed: (n: number) => plural(n, {...})`,
  `update: (name: string) => \`Update ${name}\``. Functions keep slots typed and let each language order words its
  own way.
- **One message is one whole sentence.** A sentence is never glued from pieces ("1 tool needs" + "an update to read
  storage"): Russian and Spanish change word order and agreement. Pieces that differ (a count, a name) are slots.
- Components read a catalog with `useMessages(catalog)`; code outside React (domain helpers that build sentences) takes
  the messages as an argument, or calls `messagesOf(catalog)`, which reads the current language.
- Stores keep codes and parameters, never finished sentences, so a switch also changes what is already on screen.
  Text a tool printed stays as it was printed.

## Dates, relative times and numbers

`src/i18n/format.ts` wraps `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `Intl.NumberFormat` and
`Intl.ListFormat` with the chosen language, never the system's (`toLocaleString()` without an argument would follow
the system, not the setting). Existing calls pinned to `"en-US"` or `"en-GB"` move to these helpers as each feature
is converted. Sizes (`1.4 GB`), versions, schema numbers and clock times in mono stay as the tools print them.

## Default language

`wirecat.language` in `localStorage`, beside the theme and the interface size. Empty means "follow the system": the
first of `navigator.languages` that is Russian or Spanish (any region) picks that language, anything else English.
The Language select in Settings shows each language by its own name (English, Русский, Español) and a "System"
choice that says which one it resolved to. `<html lang>` follows the language, so the webview hyphenates and reads it
correctly.

## What stays in English

- Tool names (Telegram, MAX, WhatsApp, Zoom, Google Drive, Memo), product names (WireCat, Claude Code, ChatGPT,
  Tailscale, Cloudflare) and their commands: `tg`, `config set`, every command line.
- Error codes, schema names, file paths, versions.
- What the tools print: doctor output, run logs, sign-in prompts that come from the CLI, error messages a tool returns.
  The interface translates its own sentence around them ("Telegram could not start: <tool's text>").
- The mock platform (`src/platform/mock*.ts`): it stands in for tool output.

## Rust sentences that reach the interface

Rust returns errors as strings. Most are wrapped tool output or system errors (`io::Error`), which stay as they are.
Sentences Rust writes itself, and that the interface shows, are listed while each feature is converted; where Rust
already returns a stable code (`code` fields in sign-in steps, Tailscale and Cloudflare states, storage `kind`s), the
interface maps the code to a message. Rust is not changed in this pass: a sentence that has no code is a follow-up
that gives it one.

## Tests

- `src/i18n/catalogs.test.ts`: every catalog has the same keys in every language, and every Russian value has
  Cyrillic letters unless it is on a short allowlist (names, codes).
- `src/i18n/no-literals.test.ts`: the TypeScript compiler API scans every `.tsx` outside tests and mocks for JSX text
  and for `title`, `aria-label`, `placeholder`, `alt` and `label` props with English words. Folders not converted yet
  are listed in `PENDING` in that test; each feature's commit removes its folder, so `pnpm check` stays green.
- Tests run in English (`src/testing/setup.ts`); the screenshot and layout scripts pin `en-US` and take `--lang`.

## Order

1. `src/i18n`, the Language select, the app shell, the sidebar, Settings and `src/ui`, and both tests.
2. Feature by feature, one commit each: about, update, system, onboarding, signin, agents, logs, storage, config,
   tools (in two parts), report last.
3. Screenshots of the main pages in RU and ES, light and dark, at 1280 and 960; Cyrillic fonts loaded before the first
   frame; layout-shift in RU.
