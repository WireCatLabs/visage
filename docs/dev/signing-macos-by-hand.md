# Signing the macOS app by hand, step by step

This is the same flow that `bin/make-apple-certificate` runs, written out so you can see each step. You do it once.
At the end, GitHub has what it needs to sign and notarize every macOS release. Where to keep each item afterwards:
[signing.md](signing.md#what-you-will-have-at-the-end).

How it works, in one picture:

```text
your computer                          Apple                                GitHub
-------------                          -----                                ------
1 private key (secret, stays here)
2 request file (public half of key) -> 3 checks your account,
                                         returns a certificate (.cer)
4 key + certificate + Apple's
  intermediate -> developer-id.p12
  (locked with a password)
5                                      app-specific password
6 .p12, its password, Apple ID,                                          -> 5 secrets; every release tag
  app-specific password, team ID                                            signs and notarizes the app
```

Every command below runs in a terminal on this computer. Lines that start with `#` are comments; you don't type them.
Where a command asks for a password, the text does not show as you type.

## 0. A private folder for the files

```sh
mkdir -p ~/.config/wirecat-signing
chmod 700 ~/.config/wirecat-signing
cd ~/.config/wirecat-signing
```

`chmod 700` means only your user can open the folder. Stay in this folder for every step below.

## 1. Make the private key

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -aes-256-cbc -out developer-id.key
```

- It asks twice for a **key passphrase**. Choose one and put it in your password manager now. You type it again in
  steps 2, 4b and 4d.
- **You get:** `developer-id.key`, a 2048-bit RSA key, locked with that passphrase. Apple requires RSA 2048.
- This is the secret part. Whoever has this key and its passphrase can sign apps as you. It never goes to Apple.

## 2. Make the request file

Put your Apple ID e-mail in place of `leemour@gmail.com`:

```sh
openssl req -new -key developer-id.key -out developer-id.certSigningRequest -subj "/emailAddress=leemour@gmail.com/CN=WireCat"
```

- It asks for the key passphrase from step 1.
- **You get:** `developer-id.certSigningRequest`. It holds the public half of the key and your e-mail. It is not
  secret.
- To see what is inside: `openssl req -in developer-id.certSigningRequest -noout -subject`

## 3. Get the certificate from Apple (in the browser)

Sign in as the **Account Holder** of the developer account. Only the Account Holder can make this certificate.

1. Open <https://developer.apple.com/account/resources/certificates/add>.
2. The page "Create a New Certificate" lists the kinds under **Software**. Select the last one, **Developer ID
   Application** ("This certificate is used to code sign your app for distribution outside of the Mac App Store
   Connect"). Then click **Continue** at the top right.
   - Not **Apple Distribution** or **Mac App Distribution**: those are for the App Store.
   - Not **Developer ID Installer**: that one signs `.pkg` installers, and WireCat ships a `.dmg`.
3. If the next page shows a **Profile Type** choice, I think it is **G2 Sub-CA**, the current one. I have not seen
   this page myself.
4. Click **Choose File** and select `~/.config/wirecat-signing/developer-id.certSigningRequest`. If the file dialog
   hides folders that start with a dot, press **Ctrl+H**, or type the path into the dialog. Click **Continue**.
5. Click **Download**. Your browser saves a file like `~/Downloads/developerID_application.cer`.

- **You get:** the certificate. It says "this public key belongs to your team". It is not secret.
- I have not tested whether Apple accepts a request made with `openssl` instead of a Mac. If it shows an error, send
  me the message.
- Apple allows up to five of these certificates per account.

## 4. Build the .p12 file

### 4a. Move the certificate here and convert it

```sh
mv ~/Downloads/developerID_application.cer .
openssl x509 -inform DER -in developerID_application.cer -out developer-id.pem
openssl x509 -in developer-id.pem -noout -subject -issuer -enddate
```

Apple sends the certificate as binary data (DER). `developer-id.pem` is the same certificate as text, which the next
commands read. The last command shows:

- `subject=`: it has `CN=Developer ID Application: <your name> (<TEAM ID>)` and `OU=<TEAM ID>`. Write the team ID
  down: it is 10 letters and digits, and it is not secret. You need it in step 6.
- `issuer=`: which Apple certificate signed yours. If it has `OU=G2`, use the G2 file in step 4c.
- `notAfter=`: when it expires, about five years from today.

### 4b. Check that the certificate fits your key

```sh
diff <(openssl x509 -in developer-id.pem -noout -pubkey) <(openssl pkey -in developer-id.key -pubout) && echo "The certificate matches the key."
```

It asks for the key passphrase. If it prints anything other than "The certificate matches the key.", the
certificate was made from another request file. Repeat step 3 with this folder's request file.

### 4c. Download Apple's intermediate certificate

A Mac trusts your certificate through Apple's intermediate certificate. Add it to the `.p12` so the GitHub build
machine has it.

If step 4a showed `OU=G2` in `issuer=`:

```sh
curl -fsSL https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer -o apple-ca.cer
```

If it did not:

```sh
curl -fsSL https://www.apple.com/certificateauthority/DeveloperIDCA.cer -o apple-ca.cer
```

Then convert it and look at it:

```sh
openssl x509 -inform DER -in apple-ca.cer -out apple-ca.pem
openssl x509 -in apple-ca.pem -noout -subject
```

The subject should be the same as your certificate's `issuer=` from step 4a.

### 4d. Pack everything into the .p12

```sh
openssl pkcs12 -export -inkey developer-id.key -in developer-id.pem -certfile apple-ca.pem -out developer-id.p12 -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1
```

- It asks for the key passphrase from step 1.
- Then it asks twice for an **export password**. This is the `.p12` password. Make a new, long one in your password
  manager, then paste it here.
- **You get:** `developer-id.p12`, your key, your certificate and Apple's intermediate in one locked file. GitHub
  imports it on its Mac to sign.
- `PBE-SHA1-3DES` and `sha1` choose an older lock format, because macOS's import tool cannot read the newer default
  that OpenSSL 3 uses.

To check it opens (it asks for the export password):

```sh
openssl pkcs12 -in developer-id.p12 -nokeys -info 2>&1 | grep -E "subject=|PKCS7|Shrouded"
```

You should see two `subject=` lines, yours and Apple's, and `pbeWithSHA1And3-KeyTripleDES-CBC`.

## 5. Make an app-specific password (in the browser)

GitHub sends every build to Apple to be checked (notarization). It signs in to Apple as you, and it cannot use your
normal password because of two-factor sign-in.

1. Open <https://account.apple.com> and sign in with the developer account's Apple ID.
2. Go to **Sign-In and Security**, then **App-Specific Passwords**.
3. Click **+** (or "Generate an app-specific password"), name it `WireCat notarization`, and confirm.

- **You get:** a password like `abcd-efgh-ijkl-mnop`. Apple shows it only once. Keep the page open for step 6.
- You don't need to keep it after step 6. If it is lost, revoke it on the same page and make a new one.

## 6. Give GitHub the five secrets

Each `gh secret set` without a value asks you to paste one. Paste it and press Enter. Nothing is printed.

```sh
base64 -w 0 developer-id.p12 | gh secret set APPLE_CERTIFICATE --repo WireCatLabs/wirecat-desktop
```

The `.p12` as text. GitHub's Mac turns it back into the file.

```sh
gh secret set APPLE_CERTIFICATE_PASSWORD --repo WireCatLabs/wirecat-desktop
```

Paste the export password from step 4d.

```sh
gh secret set APPLE_ID --repo WireCatLabs/wirecat-desktop
```

Paste the developer account's Apple ID e-mail.

```sh
gh secret set APPLE_PASSWORD --repo WireCatLabs/wirecat-desktop
```

Paste the app-specific password from step 5, not your normal Apple password.

```sh
gh secret set APPLE_TEAM_ID --repo WireCatLabs/wirecat-desktop
```

Paste the team ID from step 4a.

Check that all five exist (this shows names and dates only, never values):

```sh
gh secret list --repo WireCatLabs/wirecat-desktop
```

The release workflow signs only when all five exist. If one is missing, the app is built without your signature, as
it is today.

## 7. Keep the important files, delete the rest

Put these in your password manager, in one entry called "WireCat signing":

| Item | Why keep it |
| --- | --- |
| `developer-id.p12` (attach the file) | It is the only copy of your key that you can read back. GitHub secrets cannot be read back. |
| The export password (step 4d) | Without it the `.p12` cannot be opened. |
| The key passphrase (step 1) | Only for `developer-id.key`, if you keep that file too. |

Then delete the working files. The `.p12` already holds the key and both certificates, and the `.cer` can be
downloaded again from Apple:

```sh
rm developer-id.key developer-id.certSigningRequest developer-id.pem developerID_application.cer apple-ca.cer apple-ca.pem
```

You may keep `developer-id.p12` in this folder or delete it too, once it is in the password manager.

## 8. What happens next

- The next release tag (`bin/tag-release`) builds the macOS app in GitHub, signs it with the `.p12`, and sends it to
  Apple to be checked. This adds a few minutes to the build.
- After the release, the **Install check** run (GitHub → Actions → Install check, the macOS job) shows the line
  `Authority=Developer ID Application: …`, and `spctl` reports the app as `accepted`.
- On a Mac, the downloaded app opens with a double-click and no warning.

If the build fails at signing or notarization, the release is not published. Send me the link to the failed run.
