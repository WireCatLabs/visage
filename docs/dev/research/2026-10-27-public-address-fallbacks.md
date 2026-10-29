# Public HTTPS address for a local MCP server: Tailscale Funnel problems and fallbacks

Research for BUG-15 and NEED-100 (journal `docs/journal/2026-10-25-desktop-mvp.md`). Question: Tailscale did not
publish the owner's Funnel name for 2+ hours, so ChatGPT and claude.ai could not reach the server. What other ways give
`127.0.0.1:<port>` a public HTTPS address that a non-technical user can set up from Desktop, with no administrator
rights (rule 6), and that fit the shape of plan `2026-10-27-one-mcp-entry.md` sections 9–10: one public address,
`/tg/mcp`, `/max/mcp`…, and OAuth metadata under `/.well-known/oauth-protected-resource/<tool>` and
`/.well-known/oauth-authorization-server/<tool>`, with no WireCat process routing between tools.

Sources are official docs and Tailscale's own GitHub issues, read 2026-10-27. "Verified" means seen in output here.

## Verdict

1. **The owner's Funnel route works; only the public DNS record is missing.** Verified 2026-10-27 12:2x UTC:
   `curl --resolve tbooku.tail254c8e.ts.net:443:209.177.145.97 https://tbooku.tail254c8e.ts.net/.well-known/oauth-protected-resource/tg/mcp`
   completed TLS with the node's own Let's Encrypt certificate (`CN=tbooku.tail254c8e.ts.net`, issuer YE2) and
   returned 200 with the same JSON as `127.0.0.1:8765`. Funnel relays do not decrypt
   ([KB 1223](https://tailscale.com/kb/1223/funnel)), so the request reached this computer. The relay address
   `209.177.145.97` comes from another user's report
   ([#21502](https://github.com/tailscale/tailscale/issues/21502)), not from Tailscale docs.
2. **This is a Tailscale-side fault with many reports in October 2026,** not a WireCat bug. There is no documented
   command or console action that re-publishes the record. Steps for the owner are at the end.
3. **Fallback to build: Cloudflare Tunnel (named, remotely managed).** It is the only option that matches the
   WireCat shape (several paths to several ports, path kept, no WireCat router) with a stable address and no
   per-request cap that matters. It costs privacy: Cloudflare ends TLS and sees tool traffic in plain text. Who owns
   the Cloudflare account and domain is the open decision (NEED-101, NEED-102).
4. **Not a fallback:** Cloudflare quick tunnels (new address on every start; docs say no SSE), ngrok free (one
   random-but-stable domain, 20,000 requests a month, path routing unconfirmed on free, warning page on HTML), and
   the rest (one port each, or no TLS).

## Comparison

| | Tailscale Funnel (today) | Cloudflare quick tunnel | Cloudflare named tunnel, user's account + domain | Cloudflare tunnel on a WireCat domain (we issue the token) | ngrok |
| --- | --- | --- | --- | --- | --- |
| **User's steps** | Install Tailscale (system installer asks for a password), log in, allow Funnel in the admin console | None: Desktop runs `cloudflared tunnel --url` | Cloudflare account, a domain moved to Cloudflare DNS, create the tunnel and routes in the dashboard (or `cloudflared tunnel login`), paste the token | Sign in to WireCat once; Desktop gets a token and runs cloudflared | ngrok account, copy the authtoken into Desktop |
| **Cost** | Free on Personal | Free | Free tunnel ("available on all plans", [tunnel](https://developers.cloudflare.com/tunnel/)); the user also needs a domain, paid separately | Users: free. WireCat: 1,000 tunnels free per account, then $4.50/tunnel/month ([Tunnels for Platforms](https://developers.cloudflare.com/tunnel/features/tunnels-for-platforms/)); DNS records: 200 per Free zone created after 2024-09-01, 1,000 before, 3,500 on Pro ([DNS records](https://developers.cloudflare.com/dns/manage-dns-records/)) | Free: 1 GB, 20,000 requests/month, 3 endpoints ([free limits](https://ngrok.com/docs/pricing-limits/free-plan-limits/)); Pay-as-you-go $20/month base ([pricing](https://ngrok.com/docs/pricing-limits/)) |
| **Admin rights** | Install: yes (system installer). Run: no | Not stated in Cloudflare docs; standalone binaries exist ([downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/)). Only `service install` uses sudo. **Not verified** | Same | Same | Agent SDKs for Go, Rust, Python, JS ([SDKs](https://ngrok.com/docs/agent-sdks)): in-process, so no install. Inferred |
| **Path routing to several ports, path kept** | Yes (`--set-path`, in use) | **No:** one `--url` per tunnel; would need a local router (breaks section 10) | **Yes:** ingress `path` is a regex, full path passed to the service ([config file](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/); API `path` field, [configurations](https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/subresources/configurations/methods/update/)) | Yes, same ingress, set by WireCat's backend | Possibly: Traffic Policy `forward-internal` with `req.url.path.startsWith(...)` ([action](https://ngrok.com/docs/traffic-policy/actions/forward-internal/), [variables](https://ngrok.com/docs/traffic-policy/variables/req/)); free-plan availability **not found** |
| **Stable address** | Yes (`<machine>.<tailnet>.ts.net`) | **No:** "The hostname changes each time" ([quick tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)); every restart means re-adding the connector in ChatGPT/Claude | Yes | Yes (`<user>.mcp.<domain>`) | Free: one "stable, auto-assigned" dev domain ([domains](https://ngrok.com/docs/universal-gateway/domains/)) |
| **Reliability** | Public DNS publication failing for many users in Oct 2026 (below); record "up to 10 minutes" normally ([KB 1223](https://tailscale.com/kb/1223/funnel)) | "No uptime guarantee", 200 in-flight requests, then 429; "do not support Server-Sent Events" | Cloudflare's normal service; CNAME to `<UUID>.cfargotunnel.com` ([DNS](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/)) | Same, plus WireCat's backend must be up to issue tokens (not to serve traffic) | 4,000 requests/min; monthly caps on free |
| **Privacy** | **Best:** relays "do not decrypt"; TLS ends on the user's computer | Cloudflare presents the certificate ([edge certificates](https://developers.cloudflare.com/ssl/edge-certificates/)): it sees requests in plain text | Same as quick | Same, and the traffic runs through **WireCat's** Cloudflare account: WireCat can see its logs and analytics | TLS ends at ngrok's cloud for HTTPS endpoints ([TLS termination](https://ngrok.com/docs/universal-gateway/tls-termination/)); agent-side TLS only in the Go SDK and agent config, not the Rust SDK |

Other options, one line each:

- **Pinggy:** SSH or a CLI binary, Node/Python SDKs; free address is random ([docs](https://pinggy.io/docs/)). One
  port per tunnel, no documented path routing, limits page not reachable. Not a fit.
- **localhost.run:** its docs refused our fetch (TLS error), so nothing here is verified. Not recommended on that
  basis.
- **bore:** TCP only, "no further traffic is encrypted" ([repo](https://github.com/ekzhang/bore)). No HTTPS: not a fit.
- **Pangolin:** a self-hosted access platform with a managed cloud control plane ([docs](https://docs.pangolin.net/)).
  The docs read did not cover routing, client privileges or price. It means running a server: heavier than
  Cloudflare for the same result.

## Things that matter for MCP specifically

- **SSE.** cli-core's HTTP server uses the MCP SDK's `WebStandardStreamableHTTPServerTransport` without
  `enableJsonResponse` (`cli-core/src/mcp/http/serve.ts:61`); in SDK 1.32.1 the default is `false`
  (`webStandardStreamableHttp.js:74`), so answers to a POST are SSE streams, which the spec allows
  ([transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)). Cloudflare says quick
  tunnels "do not support Server-Sent Events". The owner used quick tunnels before, so either they did not break, or
  the use was before cli-core's server; **not verified**. `enableJsonResponse: true` would avoid the question for all
  tunnels.
- **ngrok's warning page** sits "in front of all HTML browser traffic on the free tier" and not in front of API
  clients. The OAuth sign-in page that ChatGPT opens is HTML in a browser, so I think the user sees ngrok's page first.
  Not tested.
- **Same-account rule.** A tunnel's `cfargotunnel.com` name only proxies DNS records in the same Cloudflare account
  ([DNS](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/)),
  so a hosted option needs the tunnel and the record in WireCat's account, and the user's own-account option needs
  the user's domain in the user's account.

## The WireCat-hosted Cloudflare option in detail

What WireCat would run (inferred from the API pages; nothing built):

1. A small backend (a Cloudflare Worker is enough) holding a Cloudflare API token with Tunnel Write and DNS Edit.
2. Per user, once: `POST /accounts/{id}/cfd_tunnel` with `config_src: "cloudflare"`
   ([create](https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/methods/create/));
   `PUT …/configurations` with ingress rules for `<user>.mcp.<domain>`: `^/tg(/|$)`, the two `.well-known` paths per
   tool, each to `http://127.0.0.1:<port>`, catch-all `http_status:404`; a proxied CNAME `<user>.mcp` →
   `<UUID>.cfargotunnel.com`; `GET …/token`
   ([token](https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/subresources/token/methods/get/)).
3. When the user adds a tool or its port changes: update the ingress. Ports must then be fixed per tool, or Desktop
   tells the backend.
4. Desktop downloads cloudflared, checks it, writes the token to a file with mode 600 and runs
   `cloudflared tunnel run --token-file <file>` (`--token-file` needs 2025.4.0+,
   [run parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/cloudflared-parameters/run-parameters/)),
   so the token is not visible in the process list.
5. Sign-in for users (Desktop has no WireCat account today), rate limits, and a reconcile job that deletes tunnels and
   records of users who left, as Cloudflare advises for Tunnels for Platforms.

Cloudflare for SaaS is the wrong product: it is for domains the **customer** owns
([SaaS](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)).

Security and abuse:

- **Plain text in WireCat's account.** Telegram, Max and WhatsApp content in tool answers passes Cloudflare decrypted,
  inside WireCat's account. That is a new data-processing role for WireCat (privacy policy, GDPR), not only a
  technical choice.
- **Anyone with a token can serve anything** on their subdomain: the ingress is fixed by WireCat, but the local service
  behind it is whatever the user runs. Phishing pages on `*.mcp.wirecat.dev` would hit the reputation of
  `wirecat.dev` (browser blocklists act on whole domains). Use a separate domain for user addresses, as ngrok does
  with its free domains.
- **Scale:** the DNS record quota, not tunnels, is the first limit on a Free zone (200 records, one per user).
- **Our API token** can create and delete every user's address; keep it in the Worker's secrets only.

## Recommendation

1. **Now:** the owner follows the Tailscale steps below and opens a support ticket. Desktop's "Check the address" step
   already detects the missing record; nothing to change there.
2. **Fallback to build, if NEED-101 says yes:** Cloudflare named tunnel with ingress path rules. Start with the
   **user's own Cloudflare account and domain** (no WireCat backend, no data in our account, works with the existing
   "a tunnel the owner runs" choice), and treat the WireCat-hosted subdomain as a later product decision with the
   privacy and abuse costs above.
3. **Independent of the choice:** consider `enableJsonResponse: true` in cli-core so no tunnel's SSE handling matters.
4. **Do not** offer quick tunnels or ngrok free as the fallback for ChatGPT/Claude connectors: the first loses the
   address on every restart, the second caps at 20,000 requests a month and puts a warning page before sign-in.

## Tailscale: what is known about missing Funnel DNS records

All from `tailscale/tailscale` issues; none is official guidance except where a Tailscale contributor wrote it.

- [#21502](https://github.com/tailscale/tailscale/issues/21502) (open): record never created or gone after a reboot,
  NXDOMAIN at all four `ts.net` nameservers (DNSimple). One reporter's record vanished after a power cycle; restarting
  `tailscaled` and toggling Funnel did not help. A node logged into a **different tailnet** got its name published at
  once. Support tickets TSS-105151 and others are open.
- [#21852](https://github.com/tailscale/tailscale/issues/21852) (open, labelled bug): a working name disappeared with
  authoritative NXDOMAIN while the node stayed connected.
- [#21829](https://github.com/tailscale/tailscale/issues/21829) (closed 2026-10-25): a Tailscale contributor stopped an
  hourly DNSimple check that "may have caused new funnel instances to take up to 30 minutes". One user fixed it by
  deleting and re-creating the `funnel` node attribute in the policy, then waiting ~15 minutes; another user's record
  stayed missing for days after toggling Funnel and upgrading to 1.104.2. The owner's outage is on 10-27, after that
  fix, so it matches #21502/#21852 rather than #21829.
- [#20892](https://github.com/tailscale/tailscale/issues/20892) (open): `ts.net` negative answers are cached for 300 s
  by resolvers; each `funnel reset` or off/on removes the record and lets resolvers cache a fresh NXDOMAIN.
- [#21429](https://github.com/tailscale/tailscale/issues/21429) (closed): the whole tailnet's names were NXDOMAIN
  because Funnel was **administratively disabled on the tailnet** by Tailscale (support confirmed). Only support can see
  this.
- [#11849](https://github.com/tailscale/tailscale/issues/11849) (open): the `funnel` node attribute must cover the
  node (tags!) or no DNS record is made.
- [#21746](https://github.com/tailscale/tailscale/issues/21746) (open): the reverse, records not removed after Funnel
  is off. Shows that publication is reconciled by Tailscale's control server, not by the node.

### Steps for the owner, in this order

1. **Stop toggling.** No more Funnel off/on and no `tailscale funnel reset`: each one can restart the 300 s negative
   cache (#20892) and did not help anyone in the reports.
2. **Check from outside**, on the phone's mobile data or any computer:
   `dig +norecurse @ns1.dnsimple.com tbooku.tail254c8e.ts.net A` (NXDOMAIN with `aa` = Tailscale has no record), or
   open `https://dns.google/resolve?name=tbooku.tail254c8e.ts.net&type=A` (`"Status": 3` = NXDOMAIN).
3. **Check the policy** at [Access controls](https://login.tailscale.com/admin/acls): `nodeAttrs` has
   `{"target": [...], "attr": ["funnel"]}` and the target covers this machine (its user, `autogroup:member`, or its
   tags) (#11849).
4. **Re-create the funnel attribute** (user-reported workaround, #21829): delete the `funnel` entry from `nodeAttrs`,
   save; add it back unchanged, save; wait 15 minutes, then repeat step 2. Desktop's "Check the address" step shows the
   moment it appears.
5. **Open a support ticket** if it is still missing: run `tailscale bugreport` on this computer
   ([bug reports](https://tailscale.com/docs/account/bug-report)) and send the `BUG-…` id through the
   [support form](https://tailscale.com/contact/support#support-form), with the name, the time it disappeared, that
   the relay serves the name (`curl --resolve` above returns 200), and links to #21502 and #21852. Ask whether Funnel is
   disabled for the tailnet (#21429).
6. **Last resort** (changes the address, so ChatGPT and Claude must be connected again): rename the machine
   (`tailscale set --hostname=<name>` or Machines → Edit machine name,
   [machine names](https://tailscale.com/kb/1098/machine-names)). A new name may get a new record; this is untested.
   A different tailnet worked at once for one reporter (#21502).

**Do not** turn HTTPS off and on in [DNS settings](https://login.tailscale.com/admin/dns): no report says it helps, and
it touches certificates; Let's Encrypt rate limits can lock a name out for up to 34 hours
([KB 1223](https://tailscale.com/kb/1223/funnel)). Upgrading Tailscale did not help the reporters on 1.102.x and
1.104.x.

## Not measured

- cloudflared running as a normal user from the app's data folder on macOS and Windows (no Cloudflare page says it).
- Whether the OAuth flow of ChatGPT or Claude works through a Cloudflare tunnel with path rules (expected, untested).
- ngrok `forward-internal` on the free plan, and ngrok's terms for shipping its SDK inside an app.
- The live DNS state at the time of writing: this computer's sandbox blocks DNS-over-HTTPS, and public DNS could not
  be fetched from outside either.
