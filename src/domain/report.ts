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

const APP_REPO = "https://github.com/WireCatLabs/wirecat-desktop"
// GitHub rejects very long prefilled URLs; the text is cut well before that.
const URL_BODY_LIMIT = 6000

export const reportTool = (about: ReportAbout) => (about === "app" || about === "" ? null : about)

export const reportRepo = (tool: string | null) => (tool && findTool(tool)?.repo) || APP_REPO

export type ReportProblem = { field: "summary" | "about" | "happened" }

export function validateReport(f: ReportFields): ReportProblem[] {
  const problems: ReportProblem[] = []
  if (!f.summary.trim()) problems.push({ field: "summary" })
  if (!f.about) problems.push({ field: "about" })
  if (!f.happened.trim()) problems.push({ field: "happened" })
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

/** Something the app showed as broken, as the place that showed it knows it. */
export type Failure = {
  /** What the app was doing, in the owner's words: "Checking Telegram". */
  what: string
  message: string
  page?: string | null
  tool?: string | null
  /** The command line the app ran, as the interface already shows it. */
  command?: string | null
  stack?: string | null
}

export type FailureReport = { about: ReportAbout; summary: string; steps: string; happened: string }

const STACK_LINES = 15
const MESSAGE_LIMIT = 1500

const clip = (s: string, limit: number) => (s.length > limit ? `${s.slice(0, limit - 1).trimEnd()}…` : s)

/** The report form, filled from a failure; the owner still reads it and presses Send. */
export function failureReport(f: Failure): FailureReport {
  const message = f.message.trim() || "No message."
  const command = f.command?.trim()
  const steps = [...(f.page ? [`Opened ${f.page}`] : []), command ? `${f.what} (the app ran \`${command}\`)` : f.what]
  const shown = `The app showed: ${clip(message, MESSAGE_LIMIT)}`
  const stack = f.stack
    ?.split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .slice(0, STACK_LINES)
    .join("\n")
  const room = LIMITS.happened - shown.length - "\n\n```\n\n```".length
  return {
    about: (f.tool && findTool(f.tool)?.id) || "app",
    summary: clip(`${f.what}: ${message.replace(/\s+/g, " ")}`, LIMITS.summary),
    steps: steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    happened: stack && room > 0 ? `${shown}\n\n\`\`\`\n${clip(stack, room)}\n\`\`\`` : shown,
  }
}
