import { describe, expect, it } from "vitest"
import { issueBody, newIssueUrl, reportDetails, reportRepo, validateReport } from "./report"

const facts = {
  app: { name: "wirecat-desktop", version: "0.1.0" },
  system: { os: "Linux", arch: "x86_64", node: "24.19.0", npm: null },
  tools: [{ id: "tg", version: "0.88.0", manager: "pnpm" }],
}
const fields = { summary: "Install fails", about: "drive", steps: "", happened: "It stops at verify.", expected: "" }

describe("report", () => {
  it("files tool problems with the tool and app problems with the app", () => {
    expect(reportRepo("drive")).toBe("https://github.com/WireCatLabs/drive-cli")
    expect(reportRepo(null)).toBe("https://github.com/WireCatLabs/visage")
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
