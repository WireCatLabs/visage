# First public release

Journal: TASK-39. Owner's decisions: Linux, macOS and Windows at once (NEED-125 B); the first release goes out
unsigned while signing is set up (NEED-126: Apple Developer account and a Certum certificate are bought); Russian and
Spanish ship in it (NEED-127 B, TASK-37).

## What gets built where

`.github/workflows/release.yml`, on a `v*` tag or by hand (`workflow_dispatch`, which GitHub offers only once the file
is on `main`).

| Job | Runner | Output | Why this way |
| --- | --- | --- | --- |
| `draft` | ubuntu-latest | the draft release | One job makes it, so the three builds cannot each make their own. It also refuses a tag that differs from `package.json`, and refuses to run without the updater key (see below). |
| `build` Linux | ubuntu-22.04 | `.AppImage`, `.deb`, `.rpm` | An AppImage runs only where glibc is at least as new as the build machine's; 22.04 reaches more systems than 24.04. |
| `build` macOS | macos-latest | one universal `.dmg` and `.app.tar.gz` | One download for every Mac, and one job fills both `darwin-aarch64` and `darwin-x86_64` in `latest.json`, so fewer jobs race to rewrite it. Cost: a bigger file and a longer build. |
| `build` Windows | windows-latest | NSIS `-setup.exe` only | NSIS installs per user, so neither the install nor an update asks for administrator rights (rule 6). The MSI installs per machine. |
| `check` | ubuntu-latest | nothing | Fails when `latest.json` lacks one of the four platforms (see Risks). |

Builds use [tauri-action](https://github.com/tauri-apps/tauri-action) v1.0.0, pinned by commit like `ci.yml`, with
`releaseId` from the `draft` job.

## Version and tags

- The version lives in `package.json` (`tauri.conf.json` reads it). Bump `src-tauri/Cargo.toml` to the same number.
- The tag is `v` + that version: `v0.1.0` first. A tag that differs fails the `draft` job.
- A version that is already published fails too; a draft of it is reused, so re-running a failed release is safe.

## The draft flow

1. Push the tag. The workflow makes the draft (notes generated from merged PRs), and the three builds upload to it.
2. `check` passes when `latest.json` has all four platforms.
3. A person installs each download, edits the notes, and presses Publish.
4. Only then do installed copies see it: the updater reads
   `https://github.com/WireCatLabs/wirecat-desktop/releases/latest/download/latest.json`, and GitHub's "latest" is the
   newest release that is neither a draft nor a prerelease
   ([GitHub REST: latest release](https://docs.github.com/en/rest/releases/releases#get-the-latest-release)).

## Automatic updates

[Tauri updater plugin](https://v2.tauri.app/plugin/updater/) plus the
[process plugin](https://v2.tauri.app/plugin/process/) for the restart.

- The app checks once at start. A found update shows an "Update to x.y.z" button in the top bar; its dialog shows the
  notes, and nothing downloads until the user presses Install and restart (rule 9). On Windows the installer closes
  the app itself ([updater docs, Windows](https://v2.tauri.app/plugin/updater/)); `installMode` is `passive`.
- **The key comes before the first tag.** Each copy trusts only the public key it was built with
  (`plugins.updater.pubkey` in `tauri.conf.json`). A release built without it can never update itself, so the
  `draft` job refuses to run until `bin/setup-updater-key` has filled the key and the secrets exist.
- **Updater files only in the release workflow.** With `createUpdaterArtifacts` on and no private key, `tauri build`
  fails (tauri-cli 2.12.4, `crates/tauri-cli/src/bundle.rs`). So it is on only through
  `--config src-tauri/tauri.release.conf.json`; `pnpm tauri build` and CI build without it.
- **Where updates do not work:**
  - A Linux `.deb` or `.rpm` copy. The plugin can replace one since 2.10, but only through pkexec or sudo
    ([updater changelog](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/updater/CHANGELOG.md)),
    and the app never asks for administrator rights. Those copies get "Download from GitHub" instead
    (`update_self_installs` in `lib.rs`: Linux without `APPIMAGE`). The AppImage updates itself.
  - An unsigned macOS app: the docs say nothing about it. I think it works, because the updater downloads without
    the quarantine flag, but it is not tested. It is the first thing to try once v0.1.1 exists.
  - Offline, GitHub down, or before the first publish: the check fails and nothing is offered.

## Signing

### macOS

`bin/setup-apple-signing <file.p12>` sets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`,
`APPLE_PASSWORD` (app-specific) and `APPLE_TEAM_ID` (read from the certificate) as repository secrets
([Tauri: macOS signing](https://v2.tauri.app/distribute/sign/macos/)). `APPLE_SIGNING_IDENTITY` is not needed: Tauri
infers it from the certificate. The workflow exports the five only when all five exist. Tauri treats a variable that
is set but empty as a certificate to import (`crates/tauri-bundler/src/bundle/macos/sign.rs`), so passing empty
secrets would fail the build. The next tag after the script is signed and notarized, with no workflow edit.

### Windows (Certum)

What Certum documents (the
[signtool manual](https://www.files.certum.eu/documents/manual_en/Signing_with_the_use_of_jarsigner_tool_and_signtool.pdf),
[software page](https://support.certum.eu/en/cert-offer-software-and-libraries/)):

- The key never leaves Certum: it is on a card or token, or in SimplySign, their cloud. SimplySign Desktop pretends
  to be a card reader and logs in with a one-time code from the phone app.
- Signing is plain `signtool sign /sha1 <thumbprint> /tr http://time.certum.pl /td sha256 /fd sha256`. In Tauri that is
  `bundle.windows.certificateThumbprint`, `digestAlgorithm: "sha256"`, `timestampUrl: "http://time.certum.pl"`,
  `tsp: true` ([Tauri: Windows signing](https://v2.tauri.app/distribute/sign/windows/)).
- Nothing about CI, a headless login or an API. There is no file to export as a GitHub secret.

So the paths are:

| Path | How | Cost |
| --- | --- | --- |
| **A. Sign on a Windows PC** (supported) | Log in to SimplySign Desktop (or plug in the card), then build there: `pnpm tauri build --bundles nsis --config <file>`, where the file is `tauri.release.conf.json` plus the four Windows fields, with `TAURI_SIGNING_PRIVATE_KEY` and its password in the environment. Upload `*-setup.exe` and `*-setup.exe.sig` to the draft with `gh release upload --clobber`, and put the new signature into `latest.json`'s `windows-x86_64` entry. | A manual step each release, on Windows. |
| B. Self-hosted runner | The same PC registered as a GitHub runner for the Windows job. | Still a phone code per session. A self-hosted runner on a public repository can run code from fork pull requests unless approval is required for outside contributors. |
| C. Unofficial TOTP tools | [ssign](https://docs.rs/crate/ssign/latest) or a community action read the SimplySign seed from its QR code and sign in Actions. | Not endorsed by Certum; the seed is a long-lived credential stored in GitHub. |

Signing an installer after the build changes it, so its updater `.sig` must be made again: path A builds and signs in
one go for that reason. Which path depends on NEED-128 (card or SimplySign). Until then Windows ships unsigned and
SmartScreen warns on first run. The workflow has no Windows signing step: A needs none, B and C need one.

## What the owner does

1. `bin/setup-updater-key`. It also commits and pushes the public key. **Before the first tag.**
2. Merge PR #1 into `main` once CI is green.
3. `bin/tag-release` on `main`. It checks the branch, the versions and the key, then pushes `v0.1.0`.
4. Check the draft (each installer, the notes, `check` green), then Publish.
5. When ready: `bin/setup-apple-signing <file.p12>`. The next tag is signed.
6. Windows signing: answer NEED-128 and NEED-129, then path A.

## If the first run fails

`release.yml` first runs on the real tag, so three things are untested until then: `--config` read from the repository
root, `latest.json` written when uploading by `releaseId`, and `check`. The draft is private, so a failure is safe:
delete the draft and the tag (`git push origin :refs/tags/v0.1.0`), fix, and run `bin/tag-release` again. A draft
left over is reused.

## Risks

- **`latest.json` can lose a platform.** Each build downloads it, adds its own platforms and uploads it again. Two
  builds that finish together can overwrite each other. `check` catches it; re-running the build whose platform is
  missing fixes it.
- **Download links in `latest.json` are GitHub API asset URLs** (tauri-action 1.0.0 changelog, #1315), which GitHub
  rate-limits without a login (60 an hour per address). Updates are rare, so this should not matter.
- **Dependabot #6** (glib 0.18, GHSA-wrw7-89jp-8q8g) cannot be fixed by a version bump: Tauri 2.12 needs gtk 0.18,
  which pins glib below 0.20 ([tauri#16264](https://github.com/tauri-apps/tauri/issues/16264), closed until gtk-rs
  is upgraded). The app does not call the affected iterator.
