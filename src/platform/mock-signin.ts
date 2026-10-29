import { delay } from "./mock-delay"
import { MOCK_CODES } from "./mock-qr"
import type { SignInEvent } from "./signin-schemas"
import type { Platform } from "./types"

// Each tool's sign-in as it streams it off a terminal with `--json --answer-stdin`. `?signin-fail=wa` makes WhatsApp
// refuse after the first code, as when another wa holds the profile; `?signin-fail=zm` is Zoom without its own app's
// Public Client ID, until one is saved.

const fails = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("signin-fail")

const WARNING = [
  "Before you link: wa is not an official WhatsApp app, and WhatsApp may ban an account that uses one.",
  "It also bans accounts that send in bulk or write to people who do not know them.",
  "wa writes only when a command asks, sends at most 30 messages an hour by default, and holds every",
  "write when WhatsApp says to slow down or restricts the account. Never send in bulk or to strangers.",
]
const RENEWS_MS = 4000

/** Profiles a mock sign-in linked, so the account list shows them afterwards. */
export const linkedProfiles: string[] = []

type Script = {
  emit: (e: SignInEvent) => void
  /** Waits, ending early on a stop; true when stopped. */
  wait: (ms: number) => Promise<boolean>
  /** Asks a question and waits for `signInAnswer`; null when stopped. */
  ask: (field: string, prompt: string, secret: boolean, hint?: string) => Promise<string | null>
  profile: string
  id: string
}

const qrs = async ({ emit, wait }: Script, scan: string, count: number, expires = false) => {
  for (let n = 0; n < count; n++) {
    const expiresAt = expires ? new Date(Date.now() + RENEWS_MS).toISOString() : null
    emit({ event: "qr", text: MOCK_CODES[n % MOCK_CODES.length] ?? "", expiresAt, scan })
    if (await wait(RENEWS_MS)) return true
  }
  return false
}

const kept = (messages: number): SignInEvent => ({
  event: "done",
  alreadyLinked: false,
  received: { chats: Math.ceil(messages / 60), messages, people: Math.ceil(messages / 130) },
})
const signedIn: SignInEvent = { event: "done", alreadyLinked: false, received: null }
const STOPPED: SignInEvent = { event: "stopped" }

let clientIdSaved = false
export const saveMockClientId = () => {
  clientIdSaved = true
}

const scripts: Record<string, (s: Script, method: string) => Promise<SignInEvent>> = {
  async wa(s) {
    for (const text of WARNING) s.emit({ event: "note", text })
    s.emit({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: WA_SCAN })
    if (fails === "wa") {
      await delay(1500)
      return {
        event: "failed",
        code: "provider_unavailable",
        message: `this WhatsApp login is in use by wa ${s.profile} serve; stop it with \`wa ${s.profile} server stop\``,
      }
    }
    if (await s.wait(RENEWS_MS)) return STOPPED
    if (await qrs(s, WA_SCAN, 2)) return STOPPED
    s.emit({ event: "progress", step: "history", message: null })
    if (await s.wait(3000)) return kept(120)
    s.emit({ event: "progress", step: "waiting", message: null })
    if (await s.wait(2500)) return kept(900)
    return kept(18_400)
  },
  async tg(s, method) {
    s.emit({
      event: "openUrl",
      url: "https://my.telegram.org/apps",
      purpose:
        "Log in with your phone number; the site sends its code in the Telegram app. Open API development tools " +
        "(if no app exists, fill App title and Short name, choose Desktop, and create it), then copy App api_id and " +
        "App api_hash.",
    })
    if ((await s.ask("api_id", "App api_id", false)) === null) return STOPPED
    if ((await s.ask("api_hash", "App api_hash (not shown)", true)) === null) return STOPPED
    if (method === "phone") {
      if ((await s.ask("phone", "phone number, international format", false)) === null) return STOPPED
      if ((await s.ask("code", "login code", false)) === null) return STOPPED
    } else if (await qrs(s, "scan in Telegram → Settings → Devices → Link Desktop Device", 2, true)) return STOPPED
    if ((await s.ask("password", "2FA password (not shown)", true, "the usual one")) === null) return STOPPED
    return signedIn
  },
  async max(s) {
    if (await qrs(s, "scan in the MAX app on your phone", 2, true)) return STOPPED
    if ((await s.ask("password", "MAX password", true, "the cat")) === null) return STOPPED
    s.emit({
      event: "note",
      text: "max is not the official MAX app, and the MAX terms do not allow automated programs (legal.max.ru/ps, 4.3.7).",
    })
    return signedIn
  },
  async zm(s) {
    if (fails === "zm" && !clientIdSaved)
      return {
        event: "failed",
        code: "configuration_error",
        message: "run zm config set zoom.client_id <Public Client ID> first",
      }
    s.emit({
      event: "openUrl",
      url: "https://zoom.us/oauth/authorize?response_type=code&client_id=mock",
      purpose: "Approve access to Zoom in the browser",
    })
    const pasted = await s.ask(
      "redirect",
      "If the browser does not come back by itself, the address it ended on (code=…&state=…)",
      true,
    )
    return pasted === null ? STOPPED : signedIn
  },
  async drive(s) {
    s.emit({
      event: "openUrl",
      url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=mock",
      purpose: "Choose the Google account and allow access to Drive",
    })
    return (await s.wait(6000)) ? STOPPED : signedIn
  },
}

const WA_SCAN = "scan in WhatsApp → Settings → Linked devices → Link a device"

export function signInMock(): Pick<Platform, "signIn" | "signInAnswer" | "signInStop"> {
  let stop: (() => void) | null = null
  let reply: ((value: string) => void) | null = null

  return {
    async signIn(id, method, profile, onEvent) {
      let stopped = false
      stop = () => {
        stopped = true
      }
      const wait = async (ms: number) => {
        const until = Date.now() + ms
        while (!stopped && Date.now() < until) await delay(100)
        return stopped
      }
      const ask: Script["ask"] = async (field, prompt, secret, hint) => {
        let answer: string | null = null
        reply = (value) => {
          answer = value
        }
        onEvent({ event: "needs", field, secret, prompt, hint: hint ?? null })
        while (!stopped && answer === null) await delay(100)
        reply = null
        if (stopped) return null
        onEvent({ event: "progress", step: "check", message: "checking" })
        await delay(700)
        return answer
      }
      await delay(500)
      const script = scripts[id]
      const end = script
        ? await script({ emit: onEvent, wait, ask, profile, id }, method)
        : ({ event: "failed", message: "This tool cannot sign in here.", code: null } as SignInEvent)
      await delay(400)
      if (end.event === "done" && !linkedProfiles.includes(profile)) linkedProfiles.push(profile)
      onEvent(end)
    },
    async signInAnswer(_id, value) {
      if (!reply) throw new Error("The sign-in has already ended.")
      reply(value)
    },
    async signInStop() {
      stop?.()
    },
  }
}
