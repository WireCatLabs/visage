import * as v from "valibot"

/** Where a configuration problem sits. Never a value from the file: values can be tokens. */
export type ConfigPlace = { file?: string; profile?: string; key?: string; line?: number; column?: number }

/** The app's own words for a finding; the interface writes them in the reader's language. */
export type DoctorNote =
  | "unreadable_issue"
  | "invalid_setting"
  | "unknown_problem"
  | "tool_error"
  | "no_config"
  | "no_data"
  | "no_token"
  | "expired"
  | "not_signed_in"
  | "no_problems"
  | "unreadable"
  | "stopped"

/**
 * `text` is what the tool said, shown as it said it; `note` is a finding in the app's own words, with the exit code
 * for the two that name one. A finding with `config` belongs to the configuration group, even when the tool did not
 * say where.
 */
export type Finding = {
  tone: "ok" | "warn" | "bad"
  text?: string
  note?: DoctorNote
  exitCode?: number | null
  fix?: string
  config?: ConfigPlace
}

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

const problemSaid = (p: v.InferOutput<typeof Problem>): Pick<Finding, "text" | "note"> => {
  const text = typeof p === "string" ? p : p.what
  return text === undefined ? { note: "unknown_problem" } : { text }
}

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
  if (!parsed.success) return { tone: "warn", note: "unreadable_issue", config: {} }
  const issue = parsed.output
  // A file that is not valid JSON stops the tool altogether; every other kind, known or new, is a warning.
  const finding: Finding = {
    tone: issue.kind === "invalid_json" ? "bad" : "warn",
    ...(issue.what === undefined ? { note: "invalid_setting" as const } : { text: issue.what }),
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
    return [{ tone: "bad", note: "unreadable", exitCode }]
  }
  const { error, item } = parsed.output
  const findings = configFindings(item?.config)
  if (error)
    return [
      ...findings,
      error.message === undefined ? { tone: "bad", note: "tool_error" } : { tone: "bad", text: error.message },
    ]

  for (const p of item?.problems ?? []) {
    const fix = typeof p === "string" ? undefined : p.fix
    findings.push(fix ? { tone: "warn", ...problemSaid(p), fix } : { tone: "warn", ...problemSaid(p) })
  }
  for (const p of item?.files?.problems ?? []) findings.push({ tone: "warn", ...problemSaid(p) })
  if (item?.config?.found === false) findings.push({ tone: "warn", note: "no_config" })
  if (item?.store?.exists === false) findings.push({ tone: "warn", note: "no_data" })
  if (item?.token?.present === false) findings.push({ tone: "warn", note: "no_token" })
  if (item?.state === "expired") findings.push({ tone: "warn", note: "expired" })
  if (item?.state === "not_configured" || item?.state === "missing")
    findings.push({ tone: "warn", note: "not_signed_in" })
  if (findings.length > 0) return findings
  return exitCode === 0 ? [{ tone: "ok", note: "no_problems" }] : [{ tone: "bad", note: "stopped", exitCode }]
}
