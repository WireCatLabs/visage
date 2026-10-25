import { describe, expect, it } from "vitest"
import { issueBody, newIssueUrl, reportRepo } from "./report"

const facts = {
  app: { name: "wirecat-desktop", version: "0.1.0" },
  system: { os: "Linux", arch: "x86_64", node: "24.19.0", npm: null },
  tools: [{ id: "tg", version: "0.88.0", manager: "pnpm" }],
}
const fields = { summary: "Install fails", details: "It stops at verify.", expected: "", tool: "drive" }

describe("report", () => {
  it("files tool problems with the tool and app problems with the app", () => {
    expect(reportRepo("drive")).toBe("https://github.com/WireCatLabs/drive-cli")
    expect(reportRepo(null)).toBe("https://github.com/WireCatLabs/visage")
  })

  it("puts the user's words and versions in the issue, and skips an empty expectation", () => {
    const body = issueBody(fields, facts)
    expect(body).toContain("It stops at verify.")
    expect(body).toContain("- tg 0.88.0 (pnpm)")
    expect(body).toContain("npm not found")
    expect(body).not.toContain("What I expected")
  })

  it("prefills GitHub's new-issue page", () => {
    const url = new URL(newIssueUrl(fields, facts))
    expect(url.pathname).toBe("/WireCatLabs/drive-cli/issues/new")
    expect(url.searchParams.get("title")).toBe("Install fails")
  })
})
