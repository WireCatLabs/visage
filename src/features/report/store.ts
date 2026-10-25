import { create } from "zustand"
import { type ReportFields, reportDetails, reportTool } from "@/domain/report"
import { platform } from "@/platform/bridge"
import type { ReportContext, ReportSent } from "@/platform/report-schemas"
import type { AppError } from "./errors"

/**
 * What the place that opened the report already knows: the tool, a first line, the steps, a masked log if any, and
 * the window's recent errors when an error opened it.
 */
export type ReportPrefill = {
  tool?: string | null
  summary?: string
  steps?: string
  details?: string
  log?: readonly string[]
  errors?: readonly AppError[]
}

type Phase = "edit" | "sending" | "sent" | "failed"

type ReportState = {
  open: boolean
  prefill: ReportPrefill
  context: ReportContext | null
  contextError: string | null
  phase: Phase
  sent: ReportSent | null
  error: string | null
  /** One key per report, kept across retries so the server never files the same report twice. */
  key: string
  start(prefill?: ReportPrefill): void
  close(): void
  send(fields: ReportFields): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * The private part of a report: recent failed runs, plus the install log when a failed install opened it and the
 * window's recent errors when an error did.
 */
export function attachmentsOf(context: ReportContext, prefill: ReportPrefill) {
  const extra = {
    ...(prefill.log?.length ? { installLog: prefill.log } : {}),
    ...(prefill.errors?.length ? { appErrors: prefill.errors } : {}),
  }
  return Object.keys(extra).length ? { ...context.attachments, ...extra } : context.attachments
}

export const useReport = create<ReportState>((set, get) => ({
  open: false,
  prefill: {},
  context: null,
  contextError: null,
  phase: "edit",
  sent: null,
  error: null,
  key: "",

  start(prefill = {}) {
    const key = crypto.randomUUID()
    set({ open: true, prefill, context: null, contextError: null, phase: "edit", sent: null, error: null, key })
    platform.reportContext().then(
      (context) => get().key === key && set({ context }),
      (e) => get().key === key && set({ contextError: message(e) }),
    )
  },

  close: () => set({ open: false }),

  async send(fields) {
    const { context, key, prefill } = get()
    if (!context) return
    set({ phase: "sending", error: null })
    try {
      const sent = await platform.sendReport(
        {
          summary: fields.summary,
          details: reportDetails(fields),
          expected: fields.expected.trim() ? fields.expected : null,
          tool: reportTool(fields.about),
          idempotencyKey: key,
        },
        { ...context, attachments: attachmentsOf(context, prefill) ?? null },
      )
      set({ phase: "sent", sent })
    } catch (e) {
      set({ phase: "failed", error: message(e) })
    }
  },
}))
