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

- The app checks at start and every 6 hours while it stays open (owner, NEED-133 A). No check runs while the update
  dialog is open or an install is under way, so the offer never changes under the user; a later check that finds
  nothing keeps the earlier offer. A found update shows an "Update to x.y.z" button in the top bar; its dialog shows the
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

Owner, 2026-10-29: the certificate is Certum's open-source code signing in the cloud (SimplySign, NEED-128 A), and
Windows is signed in GitHub Actions with an unofficial tool (NEED-129: path C below).

What Certum documents (the
[signtool manual](https://www.files.certum.eu/documents/manual_en/Signing_with_the_use_of_jarsigner_tool_and_signtool.pdf),
[software page](https://support.certum.eu/en/cert-offer-software-and-libraries/)): the key stays in Certum's cloud,
SimplySign Desktop logs in with a one-time code from the phone app, and signing is plain `signtool`. Nothing about CI,
a headless login or an API.

| Path | How | Cost |
| --- | --- | --- |
| A. Sign on a Windows PC (supported) | Build there with SimplySign Desktop logged in, upload `*-setup.exe` and its `.sig`. | A manual step each release. |
| B. Self-hosted runner | The same PC as a GitHub runner. | A phone code per session; fork pull requests on a public repository. |
| **C. ssign in Actions (chosen)** | The TOTP seed in a GitHub secret; ssign computes the code. | Not endorsed by Certum; see "The seed" below. |

**The tool: [ssign](https://github.com/Le-Syl21/ssign)**, pinned to `f7ba7b2` (v0.1.8, 2026-10-16, MIT, Rust). It was
the most used of the options found on 2026-10-29: 19 stars, 6 forks, 550 crates.io downloads, a release every 2 to 4
weeks since July. The others had 0 to 2 stars: [super-simply-sign](https://github.com/IvanHanloth/super-simply-sign)
and [windows-certum-signin](https://github.com/Rumia-Channel/windows-certum-signin) drive the SimplySign Desktop
window on a Windows runner, which broke when Certum changed its login form in October 2026
([pixlstash#1807](https://github.com/Pikselkroken/pixlstash/pull/1807)). ssign uses no window: it speaks Certum's
cloud API over HTTPS.

What it does with the secret, read in its source at that commit:

- It contacts only `cloudsign.webnotarius.pl` (Certum's cloud: OAuth login, certificate, signature) and
  `time.certum.pl` (timestamp). No other host appears in `ssign-core/src` or `src`.
- It reads `CERTUM_EMAIL` and `CERTUM_OTP` from the environment, computes the 6-digit code (SHA-256, 30 s;
  `ssign-core/src/otp.rs`), and wipes the seed from memory after parsing (`src/main.rs`, `zeroize`). It never writes
  the seed.
- It writes the session token (valid about 30 minutes) to `session.json` in the per-user temp folder on Windows
  (`ssign-core/src/session.rs`), so the next file reuses it within 20 minutes. One login covers the whole build.
- It signs PE files only (`.exe`, `.dll`); MSI is not supported, so Windows stays NSIS only.

**How the workflow uses it** (`release.yml`, Windows build):

1. The `build` job declares `environment: release`. Only jobs that declare an environment can read its secrets
   ([GitHub: environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)),
   and `bin/setup-windows-signing` limits that environment to tags `v*`. A branch, and so a pull request, cannot read
   the seed. Because of this the whole workflow runs only on a tag; by hand too, the tag must be chosen.
2. When both `CERTUM_EMAIL` and `CERTUM_OTP` exist, the runner builds ssign from the pinned commit
   (`cargo install --locked --git … --rev`) and adds `--config src-tauri/tauri.windows-sign.conf.json`. Otherwise
   Windows is built unsigned, as before.
3. That file sets Tauri's `bundle.windows.signCommand`. Tauri 2.12.4 runs it for the app `.exe`
   (`crates/tauri-bundler/src/bundle.rs:169`), the NSIS plugin DLLs, the uninstaller and the installer
   (`bundle/windows/nsis/mod.rs:695`, `:734`, `:814`), and makes the updater `.sig` afterwards
   (`crates/tauri-cli/src/bundle.rs:230-232`), so the update signature covers the signed file.
4. The two secrets reach only the tauri-action step, and only on Windows. Every build script inside that step can
   still read them, the same exposure as the updater key.
5. A last step fails the build unless Windows reports the installer's signature as `Valid`
   (`Get-AuthenticodeSignature`).

**The seed.** Once it is stored in GitHub, the phone is no longer a second factor for signing: anyone with the seed
and the login can sign as WireCat, from anywhere, until Certum resets the seed. That is why it lives in the tag-only
environment and nowhere else.

**Where to get it.** The seed is inside the QR code that activates the SimplySign phone app; the QR code holds an
`otpauth://` link. Certum's pages describe the QR code appearing on a web page, after opening the activation link from
the e-mail and entering the activation code from a second e-mail
([Certum: activating SimplySign](https://support.certum.eu/en/how-to-activate-access-to-simply-sign-application/)).
To keep it, read the QR code with a QR reader (or save it) at the same time as scanning it with the app. If the phone
is already activated, that QR code is gone: Certum's iOS manual describes a reset through Certum's help line, after
which a new QR code or a 16-character code is issued, the reset link valid for 24 hours
([SimplySign iOS manual](https://files.certum.eu/documents/manual_en/SimplySign-Instruction-manual-iOS-6-1-2.pdf)).
No self-service re-issue is documented. The reset is also how the seed is rotated if it leaks. Not verified here: none
of this was tried.

**Setting it up:** `bin/setup-windows-signing`. It asks for the login, the seed and the code the app shows now; checks
locally that the seed produces that code (nothing is sent); creates the `release` environment open only to `v*` tags;
and stores `CERTUM_EMAIL` and `CERTUM_OTP` there. Optional, stricter: add yourself as a required reviewer of the
environment (Settings → Environments → release), so each release waits for your click before it can read the seed.

## What the owner does

1. `bin/setup-updater-key`. It also commits and pushes the public key. **Before the first tag.**
2. Merge PR #1 into `main` once CI is green.
3. `bin/tag-release` on `main`. It checks the branch, the versions and the key, then pushes `v0.1.0`.
4. Check the draft (each installer, the notes, `check` green), then Publish.
5. When ready: `bin/setup-apple-signing <file.p12>` and `bin/setup-windows-signing`. The next tag is signed.

## If the first run fails

`release.yml` first runs on the real tag, so these are untested until then: Windows signing through ssign, `--config`
read from the repository root, `latest.json` written when uploading by `releaseId`, and `check`. The draft is private,
so a failure is safe: delete the draft and the tag (`git push origin :refs/tags/v0.1.0`), fix, and run
`bin/tag-release` again. A draft left over is reused.

## Risks

- **ssign is unofficial.** Certum can change its cloud API without notice and break it; the build then fails at
  signing, and dropping the two secrets ships Windows unsigned again. Each ssign process logs in once and does not
  retry. If its session file could not be written, the next file's login would reuse the same single-use code and
  fail: one failed login per build, not a loop. A community workflow warns that repeated bad codes can lock the Certum
  account ([RongxinAI#1266](https://github.com/rongxinzy/RongxinAI/pull/1266)).
- **File names that differ only in case** break the Windows and macOS builds (their file systems ignore case), while
  Linux and the `web` job pass. `permissions.ts` beside `Permissions.tsx` did exactly that until `permission-levels.ts`.

- **`latest.json` can lose a platform.** Each build downloads it, adds its own platforms and uploads it again. Two
  builds that finish together can overwrite each other. `check` catches it; re-running the build whose platform is
  missing fixes it.
- **Download links in `latest.json` are GitHub API asset URLs** (tauri-action 1.0.0 changelog, #1315), which GitHub
  rate-limits without a login (60 an hour per address). Updates are rare, so this should not matter.
- **Dependabot #6** (glib 0.18, GHSA-wrw7-89jp-8q8g) cannot be fixed by a version bump: Tauri 2.12 needs gtk 0.18,
  which pins glib below 0.20 ([tauri#16264](https://github.com/tauri-apps/tauri/issues/16264), closed until gtk-rs
  is upgraded). The app does not call the affected iterator.
