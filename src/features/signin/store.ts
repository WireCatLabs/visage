import { create } from "zustand"
import { findTool, signInMethods } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { SignInEvent } from "@/platform/signin-schemas"

type Of<K extends SignInEvent["event"]> = Extract<SignInEvent, { event: K }>
export type Qr = Of<"qr">
export type Pairing = Of<"pairingCode">
export type OpenUrl = Of<"openUrl">
export type Need = Of<"needs">
type Done = Of<"done">
type Failed = Of<"failed">

/** `signin_steps.rs`: the tool does not know the flag the app passes. */
export const NEEDS_UPDATE = "needs_update"

/** What the dialog shows: the step the tool reached last. */
export type Phase = "starting" | "scan" | "pair" | "browser" | "answer" | "progress" | "done" | "failed"

type SignInState = {
  tool: string | null
  profile: string | null
  method: string | null
  phase: Phase
  /** The code on screen; kept in memory only, and dropped when the dialog closes. */
  qr: Qr | null
  /** How many codes the tool has shown, so the window can say a new one replaced the last. */
  codes: number
  pairing: Pairing | null
  /** The page the owner approves in; it stays beside a question that follows it (Zoom's pasted address). */
  url: OpenUrl | null
  need: Need | null
  /** An answer was sent and the tool has not yet taken the next step. The answer itself is never kept here. */
  sent: boolean
  progress: Of<"progress"> | null
  notes: string[]
  done: Done | null
  failure: Failed | null
  stopping: boolean
  run: number
  onFinish: (() => void) | null
  start(tool: string, profile: string, onFinish?: () => void, method?: string): void
  answer(value: string): Promise<void>
  stop(): void
  /** While the tool runs, closing stops it first; the dialog closes when the tool has stopped. */
  close(): void
}

const closed = {
  tool: null,
  profile: null,
  method: null,
  phase: "starting" as Phase,
  qr: null,
  codes: 0,
  pairing: null,
  url: null,
  need: null,
  sent: false,
  progress: null,
  notes: [],
  done: null,
  failure: null,
  stopping: false,
  onFinish: null,
}

export const running = (phase: Phase) => phase !== "done" && phase !== "failed"

/** `wa`'s wait for the phone's history: a stop then keeps what came. */
export const receivingHistory = (s: Pick<SignInState, "phase" | "progress">) =>
  s.phase === "progress" && (s.progress?.step === "history" || s.progress?.step === "waiting")

/** The run in flight, so a new one waits for it to end. */
let ending: Promise<unknown> = Promise.resolve()

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useSignIn = create<SignInState>()((set, get) => {
  const apply = (e: SignInEvent) => {
    // Any step after a question means the tool has its answer, or no longer waits for one.
    const next = { need: null, sent: false }
    switch (e.event) {
      case "note":
        return set((s) => ({ notes: [...s.notes, e.text] }))
      case "qr":
        return set((s) => ({ ...next, phase: "scan", qr: e, codes: s.codes + 1 }))
      case "pairingCode":
        return set({ ...next, phase: "pair", pairing: e, qr: null })
      case "openUrl":
        return set({ ...next, phase: "browser", url: e, qr: null })
      case "needs":
        return set({ phase: "answer", need: e, sent: false, qr: null })
      case "progress":
        return set({ ...next, phase: "progress", progress: e, qr: null, url: null })
      case "done":
        set({ ...next, phase: "done", done: e, qr: null, url: null, stopping: false })
        return get().onFinish?.()
      case "failed":
        return set({ ...next, phase: "failed", failure: e, qr: null, url: null, stopping: false })
      case "stopped":
        return set({ ...closed })
    }
  }

  return {
    ...closed,
    run: 0,
    start(tool, profile, onFinish, method) {
      const entry = findTool(tool)
      const chosen = method ?? (entry ? signInMethods(entry)[0]?.id : undefined) ?? "qr"
      const previous = get()
      // Switching methods: the tool runs one sign-in at a time, so the last run ends before the next starts.
      const switching = previous.tool !== null && running(previous.phase)
      if (switching && previous.tool) platform.signInStop(previous.tool).catch(() => {})
      const run = previous.run + 1
      set({ ...closed, tool, profile, method: chosen, run, onFinish: onFinish ?? null })
      const mine = () => get().run === run && get().tool !== null
      const started = (switching ? ending : Promise.resolve()).then(() =>
        mine() ? platform.signIn(tool, chosen, profile, (e) => mine() && apply(e)) : undefined,
      )
      ending = started.catch(() => {})
      started.then(
        () => {
          if (mine() && running(get().phase))
            apply({ event: "failed", message: "The sign-in ended without saying how.", code: null })
        },
        (e) => mine() && apply({ event: "failed", message: message(e), code: null }),
      )
    },
    async answer(value) {
      const { tool, need, sent } = get()
      if (!tool || !need || sent) return
      set({ sent: true })
      try {
        await platform.signInAnswer(tool, value)
      } catch (e) {
        if (get().need === need) set({ sent: false })
        throw e
      }
    },
    stop() {
      const { tool, phase, stopping } = get()
      if (!tool || !running(phase) || stopping) return
      set({ stopping: true })
      platform.signInStop(tool).catch((e) => apply({ event: "failed", message: message(e), code: null }))
    },
    close() {
      if (running(get().phase) && get().tool) get().stop()
      else set({ ...closed })
    },
  }
})
