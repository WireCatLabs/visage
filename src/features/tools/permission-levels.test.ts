import { describe, expect, it } from "vitest"
import { findTool } from "@/domain/catalog"
import type { CommandAccess, Permissions } from "@/platform/permissions-schemas"
import { permissionsMessages } from "./messages-permissions"
import {
  commandLine,
  defaultLevel,
  lockReason,
  locks,
  moreBlocked,
  overview,
  partialDetail,
  removalWidens,
  stateLabel,
  stillAllowed,
  summarize,
  widensLevel,
} from "./permission-levels"

const m = permissionsMessages.en.permissions

const messages = { key: "messages", label: "Messages" }
const cmd = (path: string, writes: boolean, available = true): CommandAccess => ({
  path: path.split(" "),
  writes,
  available,
  reason: available ? null : `${path.replace(" ", ".")} is readonly in this profile`,
  permission: available ? null : path.replace(" ", "."),
})
const view = (p: Partial<Permissions>): Permissions => ({
  levels: [],
  ceiling: null,
  commands: [],
  commandsError: null,
  ...p,
})

describe("summarize", () => {
  it("calls a group partial when only some changes are allowed, and counts them", () => {
    const s = summarize(
      messages,
      view({
        levels: [
          { key: "messages", level: "readonly", origin: "profile", from: null },
          { key: "messages.send", level: "allow", origin: "profile", from: null },
        ],
        commands: [
          cmd("messages list", false),
          cmd("messages send", true),
          cmd("messages edit", true, false),
          cmd("messages delete", true, false),
          cmd("chats list", false),
        ],
      }),
    )
    expect(s.state).toBe("partial")
    expect(partialDetail(s, m)).toBe("1 of 3 changes allowed")
    expect(stateLabel(s, m)).toBe("Partial write")
    expect(s.overrides.map((o) => o.key)).toEqual(["messages.send"])
    expect(s.commands).toHaveLength(4)
  })

  it("lists what still runs in a blocked group: commands the tool checks under another key", () => {
    const contacts = summarize(
      { key: "contacts", label: "Contacts" },
      view({
        levels: [{ key: "contacts", level: "deny", origin: "profile", from: null }],
        commands: [
          cmd("contacts list", false, false),
          cmd("contacts context", false),
          cmd("contacts add", true, false),
        ],
      }),
    )
    expect(contacts.state).toBe("partial")
    expect(partialDetail(contacts, m)).toBe("1 of 2 reads allowed")
    expect(stateLabel(contacts, m)).toBe("Partial read")
    expect(stillAllowed(contacts).map((c) => c.path.join(" "))).toEqual(["contacts context"])
  })

  it("tells read only, blocked, allowed and asks first apart from what the tool reports", () => {
    const reads = [cmd("messages list", false)]
    expect(summarize(messages, view({ commands: [...reads, cmd("messages send", true, false)] })).state).toBe(
      "readonly",
    )
    expect(summarize(messages, view({ commands: [cmd("messages list", false, false)] })).state).toBe("blocked")
    expect(summarize(messages, view({ commands: reads })).state).toBe("allowed")
    const ask = view({ commands: reads, levels: [{ key: "messages", level: "ask", origin: "profile", from: null }] })
    expect(summarize(messages, ask).state).toBe("ask")
  })

  it("falls back to the owner's own level when the tool does not report per command", () => {
    const old = view({ commands: null, levels: [{ key: "messages", level: "allow", origin: "profile", from: null }] })
    expect(summarize(messages, old)).toMatchObject({ state: "allowed", reads: null, writes: null })
    expect(summarize(messages, { ...old, ceiling: "readonly" }).state).toBe("readonly")
  })

  it("resolves a group nothing names to its fallback, as the tool does", () => {
    expect(summarize(messages, view({ commands: null }))).toMatchObject({ level: "allow", state: "allowed" })
    expect(summarize(messages, view({ commands: null }), "readonly")).toMatchObject({
      level: "readonly",
      fallback: "readonly",
      state: "readonly",
    })
  })

  it("takes the fallback from the defaults section only, and allow when it names nothing", () => {
    const defaults = [
      { key: "messages", level: "readonly" as const, origin: "defaults" as const, from: null },
      { key: "chats", level: "deny" as const, origin: "profile" as const, from: null },
    ]
    expect(defaultLevel("messages", defaults)).toBe("readonly")
    expect(defaultLevel("chats", defaults)).toBe("allow")
    expect(defaultLevel("messages", null)).toBe("allow")
  })

  it("notes when the commands are held tighter than the level says", () => {
    const s = summarize(messages, view({ commands: [cmd("messages list", false, false)] }))
    expect(moreBlocked(s, "allow", m)).toBe("In practice: blocked")
    expect(moreBlocked(s, "deny", m)).toBeNull()
  })

  it("sums the groups up in one line for the closed panel", () => {
    const reads = [cmd("messages list", false)]
    const allowed = summarize(messages, view({ commands: reads }))
    const readonly = summarize(messages, view({ commands: [...reads, cmd("messages send", true, false)] }))
    expect(overview([allowed, allowed, readonly], m)).toBe("Allowed for 2 groups · Read only for 1 group")
    expect(overview([readonly, readonly], m)).toBe("Read only for all 2 groups")
  })
})

describe("changing a level", () => {
  const s = summarize(
    messages,
    view({ levels: [{ key: "messages", level: "readonly", origin: "profile", from: null }], commands: null }),
  )

  it("treats a block without a key as a lock, and removing anything but allow as widening", () => {
    const locked = {
      ...cmd("messages send", true, false),
      permission: null,
      reason: "the read-only lock blocks this change",
    }
    expect(locks([locked, locked, cmd("messages edit", true, false)], m)).toEqual([
      "the read-only lock blocks this change",
    ])
    expect(removalWidens({ key: "messages", level: "ask", origin: "profile", from: null })).toBe(true)
    expect(removalWidens({ key: "messages", level: "allow", origin: "profile", from: null })).toBe(false)
  })

  it("widens only above the current level", () => {
    expect(widensLevel(s.level, "allow")).toBe(true)
    expect(widensLevel(s.level, "ask")).toBe(true)
    expect(widensLevel(s.level, "deny")).toBe(false)
  })

  it("locks a profile's key in the defaults view and an environment variable everywhere", () => {
    expect(lockReason(s.own, true, m)).toMatch(/Choose that profile/)
    expect(lockReason(s.own, false, m)).toBeNull()
    expect(lockReason({ key: "messages", level: "deny", origin: "environment", from: "TG_X" }, false, m)).toMatch(
      /TG_X/,
    )
  })

  it("shows the exact command, with --defaults when no profile is chosen", () => {
    const tg = findTool("tg")
    if (!tg) throw new Error("tg is in the catalog")
    expect(commandLine(tg, "work", { key: "messages", level: "allow" })).toBe(
      "tg work config set --json permissions.messages allow",
    )
    expect(commandLine(tg, null, { key: "messages.send", level: null })).toBe(
      "tg config unset --json --defaults permissions.messages.send",
    )
  })
})
