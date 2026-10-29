# Signing WireCat Desktop: what to get, where it goes, how to keep it

This is the owner's guide. It lists every file, password and key that signing needs, where each one comes from, where
it goes, and how to keep it. The technical details are in
[the release plan](plans/2026-10-29-first-release.md#signing).

## Why sign

- **macOS.** A Mac shows a warning or refuses to open an app that Apple has not checked. A signed and notarized app
  opens with a normal double-click. Notarized means Apple scanned it and gave it a stamp.
- **Windows.** Windows shows "Windows protected your PC" for an unsigned installer, and Smart App Control blocks it.
  A signed installer shows "WireCat" as the publisher.
- **Updates** have their own key. It is already set up (see [The updater key](#the-updater-key-already-done)).

You do each part once. After that, every release tag is signed in GitHub without your help.

## What you will have at the end

| # | Item | Secret? | Keep a copy? |
| - | --- | --- | --- |
| 1 | Apple certificate file `developer-id.p12` | **Yes**: it can sign apps as you | **Yes**, in your password manager |
| 2 | Password of that `.p12` | **Yes** | **Yes**, in the same entry |
| 3 | Apple app-specific password | Yes | No: you can make a new one at any time |
| 4 | Certum SimplySign seed (the `otpauth://` link) | **Yes**: it can sign Windows apps as you | **Yes**, in your password manager |
| 5 | Certum login e-mail | No | It is your e-mail |
| 6 | Updater private key and its password | **Yes** | **Yes**: already in the keyring, not yet in your password manager |

Make one password-manager entry called **"WireCat signing"** and put items 1, 2, 4 and 6 in it. GitHub keeps copies
too, but nobody can read a GitHub secret back, so GitHub is not your backup.

## Before you start

Run the scripts from the up-to-date main branch:

```sh
cd ~/Projects/AI/visage/.claude/worktrees/release-main && git pull
```

You need `gh` logged in (`gh auth status`). The scripts never print a secret.

## macOS: the Apple certificate

To do it by hand and see every command, follow [signing-macos-by-hand.md](signing-macos-by-hand.md) instead of
steps 1 and 4 below.

You need the paid Apple Developer account (you have it) and its **Account Holder** login. Only the Account Holder can
make this kind of certificate.

### Step 1. Make the request file

```sh
bin/make-apple-certificate
```

- It asks for your Apple ID e-mail.
- **You get:** a private key and a request file in `~/.config/wirecat-signing/`. Only your user can open that folder.
  The script prints the path of the request file, `developer-id.certSigningRequest`.
- The key has no password yet. It stays on this computer and step 3 seals it, so do steps 2 and 3 on the same day.

### Step 2. Get the certificate from Apple

1. Open [Certificates, Identifiers & Profiles → Certificates → +](https://developer.apple.com/account/resources/certificates/add).
2. Under **Software**, select the last kind, **Developer ID Application**, then **Continue** at the top right. Not
   "Apple Distribution", "Mac App Distribution" (both App Store) or "Developer ID Installer" (`.pkg` installers);
   the script rejects other kinds.
3. If Apple asks for a profile type, I think the right one is **G2 Sub-CA**. I have not checked this.
4. Upload the request file from step 1, then **Continue**, then **Download**.

- **You get:** a file like `~/Downloads/developerID_application.cer`.
- It is public, not secret. You can download it again from the same page, so you do not need to keep it.
- I have not tested whether Apple accepts a request file made on Linux. If Apple rejects it, tell me the message.

### Step 3. Make the app-specific password

Notarization signs in to Apple as you. It cannot use your normal password, because of two-factor sign-in.

1. Open [account.apple.com](https://account.apple.com) and sign in.
2. Go to **Sign-In and Security → App-Specific Passwords → +**, and name it "WireCat notarization".

- **You get:** a password like `abcd-efgh-ijkl-mnop`. Apple shows it once.
- Keep it on screen for the next step. You don't need to save it: if it is lost, revoke it there and make a new one.

### Step 4. Make the .p12 and give everything to GitHub

```sh
bin/make-apple-certificate ~/Downloads/developerID_application.cer
```

What it does:

1. Checks that the certificate matches your key.
2. Adds Apple's intermediate certificate and seals everything in `~/.config/wirecat-signing/developer-id.p12` with a
   random 32-character password.
3. Saves that password in your keyring (service `wirecat`, account `apple-p12-password`).
4. Deletes the bare key and the other temporary files. From now on the key exists only inside the `.p12`.
5. Asks for your Apple ID and the app-specific password from step 3.
6. Saves five GitHub secrets: `APPLE_CERTIFICATE` (the `.p12`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`,
   `APPLE_PASSWORD` (the app-specific one) and `APPLE_TEAM_ID` (taken from the certificate).

### Step 5. Back up the .p12 and its password

1. Attach `~/.config/wirecat-signing/developer-id.p12` to the "WireCat signing" entry in your password manager.
2. Copy the password into the same entry:
   `secret-tool lookup service wirecat account apple-p12-password | wl-copy`. Paste it, then copy something else to
   clear the clipboard.

After that, you can leave the `.p12` on disk or delete it. It is safe in the password manager and in GitHub.

## Windows: the Certum SimplySign seed

The certificate itself stays in Certum's cloud; there is no file to download. To sign, GitHub logs in to Certum with
your e-mail and the 6-digit code that the SimplySign phone app shows. The code comes from a **seed**, a secret inside
the QR code that activated the app. GitHub needs that seed.

### Step 1. Get the seed

- **If you have not activated the phone app yet:**
  1. Open the activation link from Certum's e-mail.
  2. Enter the activation code from Certum's second e-mail. A QR code appears on the page.
  3. Before you scan it with the SimplySign app, read it with any QR reader, or take a screenshot. The reader shows
     a link that starts with `otpauth://`. That link is the seed.
  4. Then scan the same QR code with the SimplySign app as usual.
- **If the phone app is already activated:** the QR code is gone. Certum's manual describes a reset through their
  help line, after which they send a new QR code. The reset link is valid for 24 hours. Then do the steps above. I
  have not tried this.

- **You get:** the `otpauth://…` link. It is the most sensitive item in this guide: with it and your e-mail, anyone
  can sign Windows programs as WireCat until Certum resets it.
- Put it straight into the "WireCat signing" entry. Don't save it in a file or a chat. Delete the screenshot once it
  is in the password manager.

### Step 2. Give it to GitHub

```sh
bin/setup-windows-signing
```

- It asks for your SimplySign login e-mail, the seed, and the 6-digit code your phone shows now.
- It checks on this computer that the seed makes the same code as the phone. Nothing is sent for this check.
- It saves `CERTUM_EMAIL` and `CERTUM_OTP` in a GitHub area called `release` that only release tags can open. A pull
  request, or someone else's branch, cannot read them.

## The updater key (already done)

Every installed WireCat trusts this key to accept an update. It was made on 2026-10-29 and is in your keyring and in
GitHub. **If it is lost, no copy already installed can ever update again.** So copy it into the password manager now:

```sh
secret-tool lookup service wirecat account updater-key | wl-copy
```

Paste it into the "WireCat signing" entry. Do the same for the password:

```sh
secret-tool lookup service wirecat account updater-key-password | wl-copy
```

## After setup

The next release tag is signed with no other change. To check:

- The **Install check** run after the release (GitHub → Actions → Install check) shows the result.
  - On macOS: an `Authority=Developer ID Application: …` line, and Gatekeeper reports the app as accepted.
  - On Windows: `Signature: Valid`.
- On a Mac, the downloaded app opens with a double-click and no warning.

## If something is lost or leaked

| What happened | What to do |
| --- | --- |
| Laptop lost, password manager fine | Nothing urgent. GitHub still signs. Restore the files from the password manager when needed. |
| `.p12` or its password leaked | Revoke the certificate at [Certificates](https://developer.apple.com/account/resources/certificates/list), then repeat the macOS steps. Apple allows up to five such certificates. |
| App-specific password leaked | Revoke it at account.apple.com and make a new one. Run `bin/setup-apple-signing <the .p12 file>`; it asks for the `.p12` password (from the password manager) and the new app-specific password. |
| Certum seed leaked | Call Certum to reset SimplySign, then repeat the Windows steps. Until the reset, someone can sign as WireCat. |
| Updater key lost | Installed copies can no longer update. Users have to download the next version by hand. Avoid this: keep the copy in the password manager. |
