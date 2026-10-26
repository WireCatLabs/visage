import { delay } from "./mock-delay"
import { MOCK_CODES } from "./mock-qr"
import type { SignInEvent } from "./signin-schemas"
import type { Platform } from "./types"

// WhatsApp's sign-in as wa streams it off a terminal: its warning, a code that renews, then the phone's history.
// `?signin-fail=wa` makes the tool refuse after the first code, as when another wa holds the profile.

const fails = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("signin-fail")

const WARNING = [
  "Before you link: wa is not an official WhatsApp app, and WhatsApp may ban an account that uses one.",
  "It also bans accounts that send in bulk or write to people who do not know them.",
  "wa writes only when a command asks, sends at most 30 messages an hour by default, and holds every",
  "write when WhatsApp says to slow down or restricts the account. Never send in bulk or to strangers.",
]
const SCAN = "scan in WhatsApp → Settings → Linked devices → Link a device"
const RENEWS_MS = 4000
const RENEWALS = 3

/** WhatsApp profiles a mock sign-in linked, so the account list shows them afterwards. */
export const linkedProfiles: string[] = []

export function signInMock(): Pick<Platform, "signIn" | "signInStop"> {
  let stop: (() => void) | null = null

  return {
    async signIn(id, profile, onEvent) {
      let stopped = false
      stop = () => {
        stopped = true
      }
      // Each wait ends early on a stop, as the tool's own wait does on SIGTERM.
      const wait = async (ms: number) => {
        const until = Date.now() + ms
        while (!stopped && Date.now() < until) await delay(100)
        return stopped
      }
      const end = async (e: SignInEvent) => {
        await delay(400)
        if (e.event === "done" && !linkedProfiles.includes(profile)) linkedProfiles.push(profile)
        onEvent(e)
      }

      await delay(500)
      for (const text of WARNING) onEvent({ event: "note", text })
      for (let n = 0; n < RENEWALS; n++) {
        onEvent({ event: "qr", text: MOCK_CODES[n % MOCK_CODES.length] ?? "", expiresAt: null, scan: SCAN })
        if (fails === id && n === 0) {
          await delay(1500)
          return end({
            event: "failed",
            code: "provider_unavailable",
            message: `this WhatsApp login is in use by wa ${profile} serve; stop it with \`wa ${profile} server stop\``,
          })
        }
        if (await wait(RENEWS_MS)) return end({ event: "stopped" })
      }
      onEvent({ event: "progress", step: "history" })
      if (await wait(3000)) return end(kept(120))
      onEvent({ event: "progress", step: "waiting" })
      if (await wait(2500)) return end(kept(900))
      return end(kept(18_400))
    },
    async signInStop() {
      stop?.()
    },
  }
}

const kept = (messages: number): SignInEvent => ({
  event: "done",
  alreadyLinked: false,
  received: { chats: Math.ceil(messages / 60), messages, people: Math.ceil(messages / 130) },
})
