import { describe, expect, it } from "vitest"
import { failureReport, issueBody, LIMITS, newIssueUrl, reportDetails, reportRepo, validateReport } from "./report"

const facts = {
  app: { name: "wirecat-desktop", version: "0.1.0" },
  system: { os: "Linux", arch: "x86_64", node: "24.19.0", npm: null },
  tools: [{ id: "tg", version: "0.88.0", manager: "pnpm" }],
}
const fields = { summary: "Install fails", about: "drive", steps: "", happened: "It stops at verify.", expected: "" }

describe("report", () => {
  it("files tool problems with the tool and app problems with the app", () => {
    expect(reportRepo("drive")).toBe("https://github.com/WireCatLabs/drive-cli")
    expect(reportRepo(null)).toBe("https://github.com/WireCatLabs/wirecat-desktop")
  })

  it("asks for a summary, a choice of app or tool, and what happened", () => {
    const problems = validateReport({ ...fields, summary: " ", about: "", happened: "" })
    expect(problems.map((p) => p.field)).toEqual(["summary", "about", "happened"])
    expect(validateReport({ ...fields, about: "app" })).toEqual([])
  })

  it("renders the template as sections and skips the empty ones", () => {
    expect(reportDetails({ steps: "1. Open Tools\n2. Install Drive", happened: "It stops." })).toBe(
      "### What I was doing\n\n1. Open Tools\n2. Install Drive\n\n### What happened\n\nIt stops.",
    )
    const body = issueBody(fields, facts)
    expect(body).not.toContain("What I was doing")
    expect(body).not.toContain("### Expected")
    expect(body).toContain("- Tool: drive")
    expect(body).toContain("- tg 0.88.0 (pnpm)")
    expect(body).toContain("npm: not found")
    expect(issueBody({ ...fields, expected: "It verifies." }, facts)).toContain("### Expected\n\nIt verifies.")
  })

  it("prefills GitHub's new-issue page", () => {
    const url = new URL(newIssueUrl(fields, facts))
    expect(url.pathname).toBe("/WireCatLabs/drive-cli/issues/new")
    expect(url.searchParams.get("title")).toBe("Install fails")
  })
})

describe("a report filled from a failure", () => {
  it("files a tool's failure under that tool, with the page and the command the app ran", () => {
    const report = failureReport({
      what: "Releasing the task inbox-zero",
      message: "tg: task is held by another session\n(exit 3)",
      page: "Agents",
      tool: "tg",
      command: "tg personal tasks release inbox-zero",
    })
    expect(report).toEqual({
      about: "tg",
      summary: "Releasing the task inbox-zero: tg: task is held by another session (exit 3)",
      steps: "1. Opened Agents\n2. Releasing the task inbox-zero (the app ran `tg personal tasks release inbox-zero`)",
      happened: "The app showed: tg: task is held by another session\n(exit 3)",
    })
    expect(validateReport({ ...report, expected: "" })).toEqual([])
  })

  it("files everything else under the app, so the form is complete without a choice", () => {
    expect(failureReport({ what: "Reading storage", message: "denied", tool: null }).about).toBe("app")
    expect(failureReport({ what: "Reading the tasks", message: "x", tool: "claude" }).about).toBe("app")
  })

  it("keeps the summary within the limit and a render stack within the field", () => {
    const report = failureReport({
      what: "Showing this page",
      message: "TypeError: ".padEnd(400, "x"),
      stack: Array.from({ length: 40 }, (_, i) => `    at Component${i} (Page.tsx:${i})`).join("\n"),
    })
    expect(report.summary).toHaveLength(LIMITS.summary)
    expect(report.summary.endsWith("…")).toBe(true)
    expect(report.happened).toContain("at Component14 ")
    expect(report.happened).not.toContain("at Component15 ")
    expect(report.happened.length).toBeLessThanOrEqual(LIMITS.happened)
  })
})
