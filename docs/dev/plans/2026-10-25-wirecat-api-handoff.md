# Handoff — set up wirecat-api as a Rails service with health and bug reports (2026-10-25)

The trail, optional, grep by id: [journal](../../journal/2026-10-25-desktop-mvp.md) (NEED-6 is the owner's ruling).

## 1. What this is

`WireCatLabs/wirecat-api` is a new, empty, private GitHub repository. It becomes WireCat's first server: a Rails 8.1
JSON API. The first job is to receive bug reports from WireCat Desktop. The server opens a GitHub issue without
logs, returns its link, and keeps the redacted logs privately. The owner's ruling: start from a full copy of the
NBZB Rails API `trustie` (`/home/leemour/Projects/nbzb/Code/trustie`) and **remove** what is not needed, rather
than cherry-picking files into an empty app, so no infrastructure piece gets lost. The desktop client is built in
`/home/leemour/Projects/AI/visage` and already speaks the contract below.

## 2. Orient in one call

```sh
{ T=/home/leemour/Projects/nbzb/Code/trustie
  echo "== contract"; cat /home/leemour/Projects/AI/visage/docs/dev/report-api.md
  echo "== trustie surfaces and rules"; sed -n '1,40p' $T/AI_CODESTYLE.md
  echo "== public base controller"; sed -n '1,30p' $T/app/controllers/v1/public_base_controller.rb
  echo "== health"; cat $T/app/controllers/v1/health_controller.rb
  echo "== rack-attack"; sed -n '1,40p' $T/config/initializers/rack_attack.rb
  echo "== tracked files by folder"; git -C $T ls-files | cut -d/ -f1-2 | sort | uniq -c | sort -rn | head -40
  echo "== tracked secrets and NBZB-only files"; git -C $T ls-files | grep -E 'credentials|\.pem$|deploy\.yml|secrets'
  echo "== target repo"; gh repo view WireCatLabs/wirecat-api --json name,isPrivate,defaultBranchRef
} > ~/.cache/wirecat-api-orient.txt 2>&1
```

Then read `~/.cache/wirecat-api-orient.txt`. It shows:

- the request and response shapes the desktop app already sends
- trustie's three controller surfaces and why the wrong base controller ships an unauthenticated endpoint
- the public base you will inherit from
- the health check to keep as `/v1/health`
- how throttling is configured (it reads `Settings.nbzb.*`, which you rename)
- where the bulk of trustie's code is, so you know what to delete
- the tracked files that must not reach the new repo as they are

## 3. Read in this order (only if the orient output is not enough)

1. `/home/leemour/Projects/nbzb/Code/trustie/AI_CODESTYLE.md` — the house rules for controllers, forms, services
   and specs. Keep it and rewrite it for this repo.
2. `/home/leemour/Projects/nbzb/Code/trustie/config/routes.rb:1-10` and `:890-907` — how routes are laid out, and
   the Rails `/up` health route to keep.
3. `/home/leemour/Projects/nbzb/Code/trustie/app/controllers/v1/concerns/error_handler.rb` — the error envelope.
   The contract's `{"error": {code, message, fields}}` must match what this produces. Change whichever side is
   simpler, and update `report-api.md` if it is the contract.
4. `/home/leemour/Projects/nbzb/Code/trustie/config/deploy.yml` — the Kamal layout to adapt (it names NBZB hosts,
   image and buckets).
5. `/home/leemour/Projects/AI/visage/src-tauri/src/report.rs` — the client: what it sends, which statuses it
   handles, and its fallback when the server is down.

## 4. Do

1. **Copy without history or local files.** `git -C /home/leemour/Projects/nbzb/Code/trustie archive HEAD | tar -x
   -C <clone of wirecat-api>`. `archive` takes tracked files only, so `master.key`, `.env`, `coverage/`, `log/` and
   `tmp/` stay behind. Commit this as the first commit ("chore: start from trustie"), so the removals that follow
   are reviewable diffs. Check: `git -C <clone> ls-files | grep -c .` is about 2,390.
2. **Remove NBZB secrets and identity first.** Delete `config/credentials.yml.enc` and generate new credentials
   (`bin/rails credentials:edit`). Delete `trust/` and `script/selectel_logs/`. Rewrite `config/deploy.yml`, `.github/workflows/deploy.yml`, `.kamal/secrets.example`,
   `config/settings*.yml` (`Settings.nbzb` → `Settings.wirecat`), `module Trustie` in `config/application.rb:26`,
   and the database names in `config/database.yml`. Check: `grep -rniE 'nbzb|trustie|trust_(dev|test|prod)|selectel'
   --exclude-dir=.git .` prints nothing you did not mean to keep.
3. **Remove the domain.** Remove certificates, cases, verifications, partners, payments, orders, commissions,
   documents, PDF and signatures, analytics, CSV import, OpenAI, Telegram and the end-user auth. Remove their
   controllers, models, migrations, jobs, mailers, policies, serializers, specs, factories, swagger docs, locales
   and gems. Then squash the migrations into one fresh schema. Keep the infrastructure:
   - error handler and error reporter
   - semantic logging and slow-query logging
   - rack-attack, secure_headers
   - Sidekiq and sidekiq-cron
   - dry-validation forms and the service pattern
   - rswag
   - rubocop, brakeman, bundler-audit, lefthook
   - CI and dependency-audit workflows
   - Dockerfile and Kamal
   - `bin/*`

   Decision yours: keep or drop Devise `admin_user` and the `/admin/v1` surface. It leans **keep**, because the
   owner needs a private way to read stored logs later, and admin auth is the part that is costly to get right
   again. Check: `bin/rails zeitwerk:check && bundle exec rspec` pass on the reduced app.
4. **`GET /up` and `GET /v1/health`.** Keep both. Reduce `Healthcheck::CRITICAL` to what remains (Postgres,
   Redis). Check: `curl -fsS localhost:3000/up && curl -fsS localhost:3000/v1/health`.
5. **`POST /v1/reports`, exactly as `/home/leemour/Projects/AI/visage/docs/dev/report-api.md` describes.**
   - A `Report` model holds the public fields, the private `attachments` (Postgres `jsonb`), the
     `idempotency_key` (unique index), `issue_number` and `issue_url`.
   - A form validates the body. A service stores the report and enqueues a Sidekiq job that creates the issue
     with retries. The controller waits up to a few seconds for that job, then answers `201` with the issue link,
     or `202` without it.
   - A second redaction pass runs before storing (port the patterns from
     `/home/leemour/Projects/AI/visage/src-tauri/src/redact.rs`).
   - Rate limit per IP in rack-attack, and a 1 MB body limit.
   - A daily cron job deletes attachments older than 90 days.

   Decisions yours:
   - **GitHub auth:** a GitHub App with Issues write on the target repositories only, or a fine-grained token. It
     leans **App**, because it is not tied to a person and its token expires.
   - **Issue target:** everything goes to `WireCatLabs/visage`, or the report's `tool` picks that tool's repository
     (catalog `repo` field in `/home/leemour/Projects/AI/visage/catalog/tools.json`). It leans **per tool, with
     visage for the app itself**.
   - **Where logs live:** Postgres `jsonb`, or S3 through Shrine (already in trustie). It leans **jsonb** while
     each report is ≤1 MB.

   Check: request specs for 201, 202, 200 (same key), 413, 422, 429. The GitHub call is stubbed (WebMock or VCR, as
   trustie does).
6. **README, `AI_CODESTYLE.md`, `CLAUDE.md`/`AGENTS.md`, `.github/workflows`.** Rewrite them for wirecat-api.
   Check: CI is green on the first pull request.

Not in this handoff: deploying. Which server, the `api.wirecat.dev` DNS record and the GitHub App installation are
the owner's to create. List exactly what you need from them (secret names, DNS record, App permissions) in the
pull request description, never the values.

## 5. What bites

1. **`config/credentials.yml.enc` is tracked in trustie.** `git archive` copies it. It is NBZB's encrypted
   production credentials. Without the key it is useless, but it does not belong in WireCat's repository, and
   Rails will try to read it. Delete it before the first push.
2. **Picking the wrong base controller ships an endpoint without auth, or with the wrong auth.**
   `V1::PublicBaseController` and `V1::BaseController` are siblings, not a chain (`AI_CODESTYLE.md:16-25`). Reports
   inherit from the public one, on purpose.
3. **`rack_attack.rb` reads `Settings.nbzb.rate_limits.*`.** Renaming the settings namespace without updating the
   throttles disables rate limiting silently, because the lambdas return nil. Add a request spec that gets a `429`.
4. **The desktop app cannot hold a secret.** Anything shipped in the app binary is public, so there is no API key.
   Protection is the rate limit, the size limit, validation and the server-side redaction pass.
5. **The public issue must never quote `attachments`.** Not even "first 10 lines". The issue body is built from
   `summary`, `details`, `expected`, versions and the report id only, with a spec that fails if any attachment
   string appears in the issue body.
6. **trustie's comments and locales are partly in Russian.** WireCat code and messages are English. Do not keep
   `ru` locales.

## 6. Do not touch

- `/home/leemour/Projects/nbzb/Code/trustie` — read only. It is NBZB's live production API. Never commit, branch or
  run migrations there.
- `/home/leemour/Projects/AI/visage` — the desktop client is maintained there. Propose contract changes in
  `docs/dev/report-api.md` through the owner instead of editing the client.

## 7. Check

```sh
bin/rails zeitwerk:check && bundle exec rubocop && bin/brakeman -q && bundle exec rspec \
  && curl -fsS localhost:3000/up && curl -fsS localhost:3000/v1/health
```

End to end with the desktop app (needs `pnpm app` prerequisites; see `/home/leemour/Projects/AI/visage/CLAUDE.md`):
start the server on port 3000, then run `WIRECAT_API_URL=http://localhost:3000 pnpm app` in the visage checkout and
send a report from Help → Report a problem. Passing: the dialog shows the issue link and the stored report has its
attachments, while the issue body has none.
