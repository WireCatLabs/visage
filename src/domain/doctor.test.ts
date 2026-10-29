import { describe, expect, it } from "vitest"
import { summarize } from "./doctor"

describe("summarize", () => {
  it("reads memo's problems with their fixes", () => {
    const report = { item: { problems: [{ what: "No search model", fix: "memo search model download" }] } }
    expect(summarize(report, 1)).toEqual([{ tone: "warn", text: "No search model", fix: "memo search model download" }])
  })

  it("explains an expired Zoom sign-in", () => {
    expect(summarize({ item: { state: "expired" } }, 0)[0]?.note).toBe("expired")
  })

  it("passes a tool's own error message through", () => {
    expect(summarize({ error: { message: "name a profile" } }, 2)).toEqual([{ tone: "bad", text: "name a profile" }])
  })

  it("says all is well only when the tool exited cleanly", () => {
    expect(summarize({ item: {} }, 0)).toEqual([{ tone: "ok", note: "no_problems" }])
    expect(summarize({ item: {} }, 3)[0]?.tone).toBe("bad")
  })

  it("survives output it does not understand", () => {
    expect(summarize("not json", 1)[0]?.tone).toBe("bad")
  })

  describe("configuration issues", () => {
    const report = (config: object) => ({ item: { config: { path: "~/.config/tg-cli/config.json", ...config } } })
    const file = "~/.config/tg-cli/config.json"

    it("marks a file that is not valid JSON as broken, with where it breaks", () => {
      const issue = { kind: "invalid_json", file, line: 12, column: 5, what: "The settings file is not valid JSON." }
      expect(summarize(report({ found: true, issues: [issue] }), 1)).toEqual([
        { tone: "bad", text: issue.what, config: { file, line: 12, column: 5 } },
      ])
    })

    it.each([
      ["unknown_setting", "colour"],
      ["unknown_permission", "permissions.bot.store.fetch"],
      ["missing_setting", "api_id"],
      ["invalid_value", "limit"],
    ])("warns about %s with its key, profile and fix", (kind, key) => {
      const issue = {
        kind,
        file,
        profile: "work",
        key,
        what: "Something about this key.",
        fix: `tg work config unset ${key}`,
      }
      expect(summarize(report({ issues: [issue] }), 0)).toEqual([
        { tone: "warn", text: issue.what, fix: issue.fix, config: { file, profile: "work", key } },
      ])
    })

    it("still reads the single error string that released tools send", () => {
      expect(summarize(report({ error: "Unexpected token } in JSON at position 41" }), 1)).toEqual([
        { tone: "warn", text: "Unexpected token } in JSON at position 41", config: { file } },
      ])
    })

    it("prefers issues over the old error string, even when the list is empty", () => {
      const issue = { kind: "missing_setting", file, key: "api_id", what: "api_id is not set." }
      const both = summarize(report({ error: "old message", issues: [issue] }), 0)
      expect(both.map((f) => f.text)).toEqual(["api_id is not set."])
      expect(summarize(report({ error: "old message", issues: [] }), 0)).toEqual([{ tone: "ok", note: "no_problems" }])
    })

    it("shows a kind it does not know as a warning", () => {
      const issue = { kind: "deprecated_setting", key: "proxy_url", what: "proxy_url is going away." }
      expect(summarize(report({ issues: [issue] }), 0)).toEqual([
        { tone: "warn", text: "proxy_url is going away.", config: { key: "proxy_url" } },
      ])
    })

    it("keeps the other issues when one cannot be read", () => {
      const findings = summarize(
        report({ issues: [{ line: "twelve" }, { kind: "invalid_value", what: "Bad limit." }] }),
        0,
      )
      expect(findings.map((f) => [f.tone, f.text ?? f.note])).toEqual([
        ["warn", "unreadable_issue"],
        ["warn", "Bad limit."],
      ])
    })

    it("keeps configuration issues next to a tool's own error", () => {
      const issue = { kind: "invalid_json", what: "Not valid JSON." }
      const r = { error: { message: "cannot start" }, item: { config: { issues: [issue] } } }
      expect(summarize(r, 2).map((f) => f.tone)).toEqual(["bad", "bad"])
    })
  })
})
