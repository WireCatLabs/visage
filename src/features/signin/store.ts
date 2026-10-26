import { create } from "zustand"
import { platform } from "@/platform/bridge"
import type { SignInEvent } from "@/platform/signin-schemas"

type Qr = Extract<SignInEvent, { event: "qr" }>
type Done = Extract<SignInEvent, { event: "done" }>
type Failed = Extract<SignInEvent, { event: "failed" }>

export type Phase = "starting" | "scan" | "history" | "done" | "failed"

type SignInState = {
  tool: string | null
  profile: string | null
  phase: Phase
  /** The code on screen; kept in memory only, and dropped when the dialog closes. */
  qr: Qr | null
  /** How many codes the tool has shown, so the window can say a new one replaced the last. */
  codes: number
  notes: string[]
  slow: boolean
  done: Done | null
  failure: Failed | null
  stopping: boolean
  run: number
  onFinish: (() => void) | null
  start(tool: string, profile: string, onFinish?: () => void): void
  stop(): void
  /** While the tool runs, closing stops it first; the dialog closes when the tool has stopped. */
  close(): void
}

const closed = {
  tool: null,
  profile: null,
  phase: "starting" as Phase,
  qr: null,
  codes: 0,
  notes: [],
  slow: false,
  done: null,
  failure: null,
  stopping: false,
  onFinish: null,
}

export const running = (phase: Phase) => phase === "starting" || phase === "scan" || phase === "history"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useSignIn = create<SignInState>()((set, get) => {
  const apply = (e: SignInEvent) => {
    switch (e.event) {
      case "note":
        return set((s) => ({ notes: [...s.notes, e.text] }))
      case "qr":
        return set((s) => ({ phase: "scan", qr: e, codes: s.codes + 1 }))
      case "progress":
        return set({ phase: "history", qr: null, slow: e.step === "waiting" })
      case "done":
        set({ phase: "done", done: e, qr: null, stopping: false })
        return get().onFinish?.()
      case "failed":
        return set({ phase: "failed", failure: e, qr: null, stopping: false })
      case "stopped":
        return set({ ...closed })
    }
  }

  return {
    ...closed,
    run: 0,
    start(tool, profile, onFinish) {
      const run = get().run + 1
      set({ ...closed, tool, profile, run, onFinish: onFinish ?? null })
      const mine = () => get().run === run && get().tool !== null
      platform
        .signIn(tool, profile, (e) => mine() && apply(e))
        .then(
          () => {
            if (mine() && running(get().phase))
              apply({ event: "failed", message: "The sign-in ended without saying how.", code: null })
          },
          (e) => mine() && apply({ event: "failed", message: message(e), code: null }),
        )
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
