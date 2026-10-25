import type { CatalogTool, PermissionGroup } from "@/domain/catalog"
import type { CommandAccess, Level, OwnLevel, Permissions } from "@/platform/permissions-schemas"

export const LEVELS: readonly Level[] = ["allow", "ask", "readonly", "deny"]

export const LEVEL_LABEL: Record<Level, string> = {
  allow: "Allow",
  ask: "Ask first",
  readonly: "Read only",
  deny: "Block",
}

const ORDER: Record<Level, number> = { deny: 0, readonly: 1, ask: 2, allow: 3 }

export type GroupState = "allowed" | "ask" | "readonly" | "blocked" | "partial" | "default"
export type Count = { allowed: number; total: number }

export type GroupSummary = {
  group: PermissionGroup
  /** The level set on the group's own key, if any layer sets it. */
  own: OwnLevel | undefined
  /** Keys under the group that the owner set separately, such as `messages.send`. */
  overrides: OwnLevel[]
  /** null when the tool does not report per command. */
  reads: Count | null
  writes: Count | null
  state: GroupState
  commands: CommandAccess[]
}

const count = (commands: CommandAccess[]): Count => ({
  allowed: commands.filter((c) => c.available).length,
  total: commands.length,
})

const fromLevel = (level: Level): GroupState =>
  level === "allow" ? "allowed" : level === "ask" ? "ask" : level === "readonly" ? "readonly" : "blocked"

/**
 * Only arranges what the tool reported: which commands it lets this profile run, and the levels the owner wrote.
 * The tool's built-in defaults and its rules for which key a command is checked against stay in the tool.
 */
export function summarize(group: PermissionGroup, permissions: Permissions): GroupSummary {
  const own = permissions.levels.find((l) => l.key === group.key)
  const overrides = permissions.levels.filter((l) => l.key.startsWith(`${group.key}.`))
  const commands = (permissions.commands ?? []).filter((c) => c.path[0] === group.key)
  if (permissions.commands === null || commands.length === 0) {
    const ceiling = permissions.ceiling
    const level = own && ceiling && ORDER[own.level] > ORDER[ceiling] ? ceiling : (own?.level ?? ceiling)
    return { group, own, overrides, reads: null, writes: null, state: level ? fromLevel(level) : "default", commands }
  }
  const reads = count(commands.filter((c) => !c.writes))
  const writes = count(commands.filter((c) => c.writes))
  const allowed = reads.allowed + writes.allowed
  const state: GroupState =
    allowed === commands.length
      ? own?.level === "ask"
        ? "ask"
        : "allowed"
      : allowed === 0
        ? "blocked"
        : reads.allowed === reads.total && writes.allowed === 0
          ? "readonly"
          : "partial"
  return { group, own, overrides, reads, writes, state, commands }
}

export const STATE_LABEL: Record<GroupState, string> = {
  allowed: "Allowed",
  ask: "Asks first",
  readonly: "Read only",
  blocked: "Blocked",
  partial: "Partial",
  default: "Not set",
}

const mixed = (c: Count) => c.allowed > 0 && c.allowed < c.total

/** The state in words; a partial group says which half is partly blocked, as `partialDetail` counts it. */
export function stateLabel(s: GroupSummary): string {
  if (s.state !== "partial" || !s.reads || !s.writes) return STATE_LABEL[s.state]
  return mixed(s.writes) || !mixed(s.reads) ? "Partial write" : "Partial read"
}

/** "3 of 8 changes allowed", for the half that is partly blocked. */
export function partialDetail(s: GroupSummary): string | null {
  if (s.state !== "partial" || !s.reads || !s.writes) return null
  if (mixed(s.writes) || !mixed(s.reads)) return `${s.writes.allowed} of ${s.writes.total} changes allowed`
  return `${s.reads.allowed} of ${s.reads.total} reads allowed`
}

export const blockedCommands = (s: GroupSummary) => s.commands.filter((c) => !c.available)

/** In a partial group, the commands that still run in the half that is partly blocked. */
export function stillAllowed(s: GroupSummary): CommandAccess[] {
  if (s.state !== "partial" || !s.reads || !s.writes) return []
  const changes = mixed(s.writes) || !mixed(s.reads)
  return s.commands.filter((c) => c.available && c.writes === changes)
}

/** A command the tool blocks without naming a key no level can lift, such as a read-only lock in the environment. */
export const isLock = (c: CommandAccess) => !c.available && c.permission === null

export const locks = (commands: readonly CommandAccess[] | null) => [
  ...new Set((commands ?? []).filter(isLock).map((c) => c.reason ?? "The tool blocks it without saying why.")),
]

/** Removing a level falls back to the tool's default, which is wider unless the level already allowed everything. */
export const removalWidens = (own: OwnLevel | undefined) => own?.level !== "allow"

/** How permissive the group is now, for deciding whether a new level widens it. */
function currentOrder(s: GroupSummary): number {
  if (s.own) return ORDER[s.own.level]
  return { allowed: 3, ask: 2, readonly: 1, partial: 1, blocked: 0, default: 1 }[s.state]
}

export const widens = (s: GroupSummary, next: Level) => ORDER[next] > currentOrder(s)
export const widensLevel = (from: Level | undefined, next: Level) => ORDER[next] > (from ? ORDER[from] : 1)

/** The view a level belongs to; a key from another layer can be overridden here but not removed. */
export function layerOf(level: OwnLevel, defaultsView: boolean): "here" | "defaults" | "profile" | "elsewhere" {
  if (level.origin === "profile") return defaultsView ? "profile" : "here"
  if (level.origin === "defaults") return defaultsView ? "here" : "defaults"
  return "elsewhere"
}

/** Why a key cannot be changed in this view, or null when it can. */
export function lockReason(level: OwnLevel | undefined, defaultsView: boolean): string | null {
  if (!level) return null
  const layer = layerOf(level, defaultsView)
  if (layer === "profile") return "A profile sets this, not the defaults. Choose that profile to change it."
  if (layer === "elsewhere" && level.origin === "environment")
    return `Set by the environment variable ${level.from ?? ""}. Change or remove it there.`
  return null
}

/** Exactly what the app runs, so the owner can see it and repeat it in a terminal. */
export function commandLine(
  tool: CatalogTool,
  profile: string | null,
  change: { key: string; level: Level | null },
): string {
  const src = tool.settings
  const template = change.level === null ? src?.unset : src?.set
  const args = (template ?? []).flatMap((a) => (a === "{profile}" ? (profile === null ? [] : [profile]) : [a]))
  if (profile === null) args.push("--defaults")
  args.push(`permissions.${change.key}`)
  if (change.level !== null) args.push(change.level)
  return [tool.bin, ...args].join(" ")
}

/** One line for the closed Permissions panel: "Allowed for 4 groups · Read only for 2 groups". */
export function overview(summaries: readonly GroupSummary[]): string {
  const counts = new Map<string, number>()
  for (const s of summaries) counts.set(stateLabel(s), (counts.get(stateLabel(s)) ?? 0) + 1)
  const groups = (n: number) => `${n} ${n === 1 ? "group" : "groups"}`
  if (counts.size === 1) {
    const [label] = counts.keys()
    if (label === STATE_LABEL.default) return "Nothing set; the tool's own defaults apply"
    return summaries.length === 1 ? `${label}` : `${label} for all ${groups(summaries.length)}`
  }
  return [...counts].map(([label, n]) => `${label} for ${groups(n)}`).join(" · ")
}
