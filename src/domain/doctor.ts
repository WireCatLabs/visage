import * as v from "valibot"

export type Finding = { tone: "ok" | "warn" | "bad"; text: string; fix?: string }

const Problem = v.union([v.string(), v.looseObject({ what: v.optional(v.string()), fix: v.optional(v.string()) })])

// Each tool's doctor speaks its own JSON; these are the fields that mean "something is wrong" in any of them.
const Report = v.looseObject({
  error: v.optional(v.looseObject({ message: v.optional(v.string()) })),
  item: v.optional(
    v.looseObject({
      problems: v.optional(v.array(Problem)),
      files: v.optional(v.looseObject({ problems: v.optional(v.array(Problem)) })),
      config: v.optional(v.looseObject({ error: v.optional(v.string()), found: v.optional(v.boolean()) })),
      store: v.optional(v.looseObject({ exists: v.optional(v.boolean()) })),
      token: v.optional(v.looseObject({ present: v.optional(v.boolean()) })),
      state: v.optional(v.string()),
    }),
  ),
})

const problemText = (p: v.InferOutput<typeof Problem>) => (typeof p === "string" ? p : (p.what ?? "Unknown problem"))

export function summarize(report: unknown, exitCode: number | null): Finding[] {
  const parsed = v.safeParse(Report, report)
  if (!parsed.success) {
    return [{ tone: "bad", text: `The tool's answer could not be read (exit code ${exitCode ?? "unknown"}).` }]
  }
  const { error, item } = parsed.output
  if (error) return [{ tone: "bad", text: error.message ?? "The tool reported an error." }]

  const findings: Finding[] = []
  for (const p of item?.problems ?? []) {
    const fix = typeof p === "string" ? undefined : p.fix
    findings.push(fix ? { tone: "warn", text: problemText(p), fix } : { tone: "warn", text: problemText(p) })
  }
  for (const p of item?.files?.problems ?? []) findings.push({ tone: "warn", text: problemText(p) })
  if (item?.config?.error) findings.push({ tone: "warn", text: item.config.error })
  if (item?.config?.found === false) findings.push({ tone: "warn", text: "No configuration file yet." })
  if (item?.store?.exists === false)
    findings.push({ tone: "warn", text: "No local data yet. Nothing has been synced." })
  if (item?.token?.present === false) findings.push({ tone: "warn", text: "Not signed in: no token for this profile." })
  if (item?.state === "expired")
    findings.push({ tone: "warn", text: "Sign-in has expired. Connect again to renew it." })
  if (item?.state === "not_configured" || item?.state === "missing") {
    findings.push({ tone: "warn", text: "Not signed in yet." })
  }
  if (findings.length > 0) return findings
  return exitCode === 0
    ? [{ tone: "ok", text: "No problems found." }]
    : [{ tone: "bad", text: `The check stopped with exit code ${exitCode ?? "unknown"}.` }]
}
