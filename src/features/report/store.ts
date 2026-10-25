import { create } from "zustand"
import { platform } from "@/platform/bridge"
import type { ReportContext, ReportSent } from "@/platform/report-schemas"

/** What the place that opened the report already knows: the tool, a first line, and a masked log if any. */
export type ReportPrefill = { tool?: string | null; summary?: string; details?: string; log?: readonly string[] }

type Phase = "edit" | "sending" | "sent" | "failed"

type ReportState = {
  open: boolean
  prefill: ReportPrefill
  attachLogs: boolean
  context: ReportContext | null
  contextError: string | null
  phase: Phase
  sent: ReportSent | null
  error: string | null
  /** One key per report, kept across retries so the server never files the same report twice. */
  key: string
  start(prefill?: ReportPrefill): void
  close(): void
  setAttachLogs(on: boolean): Promise<void>
  send(fields: { summary: string; details: string; expected: string; tool: string | null }): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useReport = create<ReportState>((set, get) => {
  const loadContext = async () => {
    const attach = get().attachLogs
    set({ context: null, contextError: null })
    try {
      const context = await platform.reportContext(attach)
      if (get().attachLogs === attach) set({ context })
    } catch (e) {
      set({ contextError: message(e) })
    }
  }

  return {
    open: false,
    prefill: {},
    attachLogs: false,
    context: null,
    contextError: null,
    phase: "edit",
    sent: null,
    error: null,
    key: "",

    start(prefill = {}) {
      set({
        open: true,
        prefill,
        attachLogs: false,
        phase: "edit",
        sent: null,
        error: null,
        key: crypto.randomUUID(),
      })
      void loadContext()
    },

    close: () => set({ open: false }),

    async setAttachLogs(on) {
      set({ attachLogs: on })
      await loadContext()
    },

    async send(fields) {
      const { context, key, prefill, attachLogs } = get()
      if (!context) return
      set({ phase: "sending", error: null })
      const attachments =
        attachLogs && prefill.log?.length ? { ...context.attachments, installLog: prefill.log } : context.attachments
      try {
        const sent = await platform.sendReport(
          {
            summary: fields.summary,
            details: fields.details,
            expected: fields.expected.trim() ? fields.expected : null,
            tool: fields.tool,
            idempotencyKey: key,
          },
          { ...context, attachments: attachments ?? null },
        )
        set({ phase: "sent", sent })
      } catch (e) {
        set({ phase: "failed", error: message(e) })
      }
    },
  }
})
