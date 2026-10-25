import * as v from "valibot"

/** Where a configuration problem sits. Never a value from the file: values can be tokens. */
export type ConfigPlace = { file?: string; profile?: string; key?: string; line?: number; column?: number }

/** A finding with `config` belongs to the configuration group, even when the tool did not say where. */
export type Finding = { tone: "ok" | "warn" | "bad"; text: string; fix?: string; config?: ConfigPlace }

const Problem = v.union([v.string(), v.looseObject({ what: v.optional(v.string()), fix: v.optional(v.string()) })])

const Issue = v.looseObject({
  kind: v.optional(v.string()),
  file: v.optional(v.string()),
  profile: v.optional(v.string()),
  key: v.optional(v.string()),
  line: v.optional(v.number()),
  column: v.optional(v.number()),
  what: v.optional(v.string()),
  fix: v.optional(v.string()),
})

// Each tool's doctor speaks its own JSON; these are the fields that mean "something is wrong" in any of them.
const Report = v.looseObject({
  error: v.optional(v.looseObject({ message: v.optional(v.string()) })),
  item: v.optional(
    v.looseObject({
      problems: v.optional(v.array(Problem)),
      files: v.optional(v.looseObject({ problems: v.optional(v.array(Problem)) })),
      config: v.optional(
        v.looseObject({
          path: v.optional(v.string()),
          // Issues are read one by one, so a single malformed one does not hide the rest of the report.
          issues: v.optional(v.array(v.unknown())),
          error: v.optional(v.string()),
          found: v.optional(v.boolean()),
        }),
      ),
      store: v.optional(v.looseObject({ exists: v.optional(v.boolean()) })),
      token: v.optional(v.looseObject({ present: v.optional(v.boolean()) })),
      state: v.optional(v.string()),
    }),
  ),
})

type Config = NonNullable<NonNullable<v.InferOutput<typeof Report>["item"]>["config"]>

const problemText = (p: v.InferOutput<typeof Problem>) => (typeof p === "string" ? p : (p.what ?? "Unknown problem"))

function place(i: v.InferOutput<typeof Issue>): ConfigPlace {
  const at: ConfigPlace = {}
  if (i.file) at.file = i.file
  if (i.profile) at.profile = i.profile
  if (i.key) at.key = i.key
  if (i.line !== undefined) at.line = i.line
  if (i.column !== undefined) at.column = i.column
  return at
}

function issueFinding(raw: unknown): Finding {
  const parsed = v.safeParse(Issue, raw)
  if (!parsed.success) return { tone: "warn", text: "A configuration problem could not be read.", config: {} }
  const issue = parsed.output
  // A file that is not valid JSON stops the tool altogether; every other kind, known or new, is a warning.
  const finding: Finding = {
    tone: issue.kind === "invalid_json" ? "bad" : "warn",
    text: issue.what ?? "A setting is not valid.",
    config: place(issue),
  }
  if (issue.fix) finding.fix = issue.fix
  return finding
}

// Tool versions from before `issues` send one `error` string instead.
function configFindings(config: Config | undefined): Finding[] {
  if (config?.issues) return config.issues.map(issueFinding)
  if (config?.error) return [{ tone: "warn", text: config.error, config: config.path ? { file: config.path } : {} }]
  return []
}

export function summarize(report: unknown, exitCode: number | null): Finding[] {
  const parsed = v.safeParse(Report, report)
  if (!parsed.success) {
    return [{ tone: "bad", text: `The tool's answer could not be read (exit code ${exitCode ?? "unknown"}).` }]
  }
  const { error, item } = parsed.output
  const findings = configFindings(item?.config)
  if (error) return [...findings, { tone: "bad", text: error.message ?? "The tool reported an error." }]

  for (const p of item?.problems ?? []) {
    const fix = typeof p === "string" ? undefined : p.fix
    findings.push(fix ? { tone: "warn", text: problemText(p), fix } : { tone: "warn", text: problemText(p) })
  }
  for (const p of item?.files?.problems ?? []) findings.push({ tone: "warn", text: problemText(p) })
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
