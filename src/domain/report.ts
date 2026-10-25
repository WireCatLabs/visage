import { findTool } from "./catalog"

/** "app" is WireCat Desktop itself; "" means the reporter has not chosen yet. */
export type ReportAbout = "" | "app" | (string & {})

export type ReportFields = { summary: string; about: ReportAbout; steps: string; happened: string; expected: string }

export type ReportFacts = {
  app: { name: string; version: string }
  system: { os: string; arch: string; node: string | null; npm: string | null }
  tools: readonly { id: string; version: string | null; manager: string }[]
}

export const LIMITS = { summary: 120, steps: 4000, happened: 5000, expected: 5000 } as const

const APP_REPO = "https://github.com/WireCatLabs/visage"
// GitHub rejects very long prefilled URLs; the text is cut well before that.
const URL_BODY_LIMIT = 6000

export const reportTool = (about: ReportAbout) => (about === "app" || about === "" ? null : about)

export const reportRepo = (tool: string | null) => (tool && findTool(tool)?.repo) || APP_REPO

export type ReportProblem = { field: "summary" | "about" | "happened"; message: string }

export function validateReport(f: ReportFields): ReportProblem[] {
  const problems: ReportProblem[] = []
  if (!f.summary.trim()) problems.push({ field: "summary", message: "Write a one-line summary of the problem." })
  if (!f.about) problems.push({ field: "about", message: "Choose the app or a tool." })
  if (!f.happened.trim()) problems.push({ field: "happened", message: "Describe what went wrong." })
  return problems
}

// The server takes one free-text `details`; the template's sections travel inside it (docs/dev/report-api.md).
export function reportDetails(f: Pick<ReportFields, "steps" | "happened">): string {
  const steps = f.steps.trim()
  const happened = `### What happened\n\n${f.happened.trim()}`
  return steps ? `### What I was doing\n\n${steps}\n\n${happened}` : happened
}

/** The public issue as wirecat-api renders it: the user's words and versions, never logs. */
export function issueBody(f: ReportFields, facts: ReportFacts): string {
  const tool = reportTool(f.about)
  const environment = [
    `- App: ${facts.app.name} ${facts.app.version}`,
    `- OS: ${facts.system.os} ${facts.system.arch}`,
    `- Node: ${facts.system.node ?? "not found"}, npm: ${facts.system.npm ?? "not found"}`,
    ...(tool ? [`- Tool: ${tool}`] : []),
    ...facts.tools.map((t) => `- ${t.id} ${t.version ?? "unknown"} (${t.manager})`),
  ]
  return [
    reportDetails(f),
    ...(f.expected.trim() ? [`### Expected\n\n${f.expected.trim()}`] : []),
    `### Environment\n\n${environment.join("\n")}`,
  ].join("\n\n")
}

/** The fallback when the WireCat server cannot be reached: GitHub's own new-issue page, prefilled. */
export function newIssueUrl(f: ReportFields, facts: ReportFacts): string {
  const body = issueBody(f, facts)
  const cut = body.length > URL_BODY_LIMIT ? `${body.slice(0, URL_BODY_LIMIT)}\n\n…` : body
  const q = new URLSearchParams({ title: f.summary.trim(), body: cut })
  return `${reportRepo(reportTool(f.about))}/issues/new?${q}`
}
