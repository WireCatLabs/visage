import type { CatalogTool, PermissionGroup } from "@/domain/catalog"
import type { CommandAccess, Level, OwnLevel, Permissions } from "@/platform/permissions-schemas"
import type { PermissionsText } from "./messages-permissions"

type Words = PermissionsText

export const LEVELS: readonly Level[] = ["allow", "ask", "readonly", "deny"]

const ORDER: Record<Level, number> = { deny: 0, readonly: 1, ask: 2, allow: 3 }

/**
 * What a group key gets when no section of the file names it. cli-core's `levelFor` allows a path nothing names, and
 * its built-in defaults (`DEFAULT_PERMISSIONS`) name only keys under a group, such as `messages.delete`.
 */
export const BUILT_IN: Level = "allow"

/** The level a group falls back to here: the `defaults` section's in a profile, else the built-in one. */
export const defaultLevel = (key: string, defaults: readonly OwnLevel[] | null): Level =>
  defaults?.find((l) => l.key === key && l.origin === "defaults")?.level ?? BUILT_IN

export const capped = (level: Level, ceiling: Level | null): Level =>
  ceiling && ORDER[ceiling] < ORDER[level] ? ceiling : level

export type GroupState = "allowed" | "ask" | "readonly" | "blocked" | "partial"
export type Count = { allowed: number; total: number }

export type GroupSummary = {
  group: PermissionGroup
  /** The level set on the group's own key, if any layer sets it. */
  own: OwnLevel | undefined
  /** What the group falls back to with no level of its own in this view. */
  fallback: Level
  /** The group's own key as it stands: its own level, or the fallback. */
  level: Level
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
export function summarize(group: PermissionGroup, permissions: Permissions, fallback: Level = BUILT_IN): GroupSummary {
  const own = permissions.levels.find((l) => l.key === group.key)
  const level = own?.level ?? fallback
  const overrides = permissions.levels.filter((l) => l.key.startsWith(`${group.key}.`))
  const commands = (permissions.commands ?? []).filter((c) => c.path[0] === group.key)
  const base = { group, own, fallback, level, overrides, commands }
  if (permissions.commands === null || commands.length === 0)
    return { ...base, reads: null, writes: null, state: fromLevel(capped(level, permissions.ceiling)) }
  const reads = count(commands.filter((c) => !c.writes))
  const writes = count(commands.filter((c) => c.writes))
  const allowed = reads.allowed + writes.allowed
  const state: GroupState =
    allowed === commands.length
      ? level === "ask"
        ? "ask"
        : "allowed"
      : allowed === 0
        ? "blocked"
        : reads.allowed === reads.total && writes.allowed === 0
          ? "readonly"
          : "partial"
  return { ...base, reads, writes, state }
}

const mixed = (c: Count) => c.allowed > 0 && c.allowed < c.total

/** The state in words; a partial group says which half is partly blocked, as `partialDetail` counts it. */
export function stateLabel(s: GroupSummary, m: Words): string {
  if (s.state !== "partial" || !s.reads || !s.writes) return m.states[s.state]
  return mixed(s.writes) || !mixed(s.reads) ? m.partialWrite : m.partialRead
}

/** "3 of 8 changes allowed", for the half that is partly blocked. */
export function partialDetail(s: GroupSummary, m: Words): string | null {
  if (s.state !== "partial" || !s.reads || !s.writes) return null
  if (mixed(s.writes) || !mixed(s.reads)) return m.changesAllowed(s.writes.allowed, s.writes.total)
  return m.readsAllowed(s.reads.allowed, s.reads.total)
}

const STATE_ORDER: Record<GroupState, number> = { blocked: 0, readonly: 1, partial: 1, ask: 2, allowed: 3 }

/** When the commands the tool reports are held tighter than the level says, such as reads blocked under another key. */
export function moreBlocked(s: GroupSummary, level: Level, m: Words): string | null {
  if (s.state === "partial" || STATE_ORDER[s.state] >= ORDER[level]) return null
  return m.inPractice[s.state]
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

export const locks = (commands: readonly CommandAccess[] | null, m: Words) => [
  ...new Set((commands ?? []).filter(isLock).map((c) => c.reason ?? m.lockUnexplained)),
]

/**
 * Removing a key set under a group falls back to a built-in default the app does not know, such as
 * `messages.delete: ask`, so anything but allow may widen.
 */
export const removalWidens = (own: OwnLevel | undefined) => own?.level !== "allow"

export const widensLevel = (from: Level | undefined, next: Level) => ORDER[next] > (from ? ORDER[from] : 1)

/** The view a level belongs to; a key from another layer can be overridden here but not removed. */
export function layerOf(level: OwnLevel, defaultsView: boolean): "here" | "defaults" | "profile" | "elsewhere" {
  if (level.origin === "profile") return defaultsView ? "profile" : "here"
  if (level.origin === "defaults") return defaultsView ? "here" : "defaults"
  return "elsewhere"
}

/** Why a key cannot be changed in this view, or null when it can. */
export function lockReason(level: OwnLevel | undefined, defaultsView: boolean, m: Words): string | null {
  if (!level) return null
  const layer = layerOf(level, defaultsView)
  if (layer === "profile") return m.lockProfile
  if (layer === "elsewhere" && level.origin === "environment") return m.lockEnv(level.from ?? "")
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
export function overview(summaries: readonly GroupSummary[], m: Words): string {
  const counts = new Map<string, number>()
  for (const s of summaries) counts.set(stateLabel(s, m), (counts.get(stateLabel(s, m)) ?? 0) + 1)
  if (counts.size === 1) {
    const [label = ""] = counts.keys()
    return summaries.length === 1 ? label : m.overviewAll(label, summaries.length)
  }
  return [...counts].map(([label, n]) => m.overviewSome(label, n)).join(" · ")
}
