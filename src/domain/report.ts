import { findTool } from "./catalog"

export type ReportFields = { summary: string; details: string; expected: string; tool: string | null }

export type ReportFacts = {
  app: { name: string; version: string }
  system: { os: string; arch: string; node: string | null; npm: string | null }
  tools: readonly { id: string; version: string | null; manager: string }[]
}

const APP_REPO = "https://github.com/WireCatLabs/visage"
// GitHub rejects very long prefilled URLs; the text is cut well before that.
const URL_BODY_LIMIT = 6000

export const reportRepo = (tool: string | null) => (tool && findTool(tool)?.repo) || APP_REPO

/** What the public issue says: the user's words and versions, never logs. */
export function issueBody(f: ReportFields, facts: ReportFacts): string {
  const versions = [
    `- WireCat Desktop ${facts.app.version}`,
    `- ${facts.system.os} ${facts.system.arch}`,
    `- Node.js ${facts.system.node ?? "not found"}, npm ${facts.system.npm ?? "not found"}`,
    ...facts.tools.map((t) => `- ${findTool(t.id)?.bin ?? t.id} ${t.version ?? "does not start"} (${t.manager})`),
  ]
  return [
    "### What happened",
    f.details.trim(),
    ...(f.expected.trim() ? ["", "### What I expected", f.expected.trim()] : []),
    "",
    "### Versions",
    ...versions,
  ].join("\n")
}

/** The fallback when the WireCat server cannot be reached: GitHub's own new-issue page, prefilled. */
export function newIssueUrl(f: ReportFields, facts: ReportFacts): string {
  const body = issueBody(f, facts)
  const cut = body.length > URL_BODY_LIMIT ? `${body.slice(0, URL_BODY_LIMIT)}\n\n…` : body
  const q = new URLSearchParams({ title: f.summary.trim(), body: cut })
  return `${reportRepo(f.tool)}/issues/new?${q}`
}
