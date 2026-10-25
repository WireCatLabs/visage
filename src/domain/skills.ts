import { isNewer } from "./status"

export type SkillTarget = "claude" | "agents"

export const SKILL_TARGETS: readonly SkillTarget[] = ["claude", "agents"]

export const TARGET_FOLDER: Record<SkillTarget, string> = { claude: "~/.claude/skills", agents: "~/.agents/skills" }

type CopyState = "current" | "stale" | "missing" | "unversioned"

export type SkillReportLike = {
  source: "status" | "doctor" | "none"
  targets: readonly { target: SkillTarget; installed: string | null; state: CopyState | null }[]
}

export type SkillCell =
  | { kind: "checking" }
  | { kind: "current"; installed: string }
  | { kind: "stale"; installed: string }
  | { kind: "missing" }
  | { kind: "unversioned" }
  /** The tool is too old to report its skill. */
  | { kind: "unknown" }
  | { kind: "failed"; message: string }

const compare = (installed: string, cli: string | null): SkillCell =>
  cli && isNewer(cli, installed) ? { kind: "stale", installed } : { kind: "current", installed }

/**
 * One cell of the matrix. A version written by an install in this session wins, because
 * a tool without `skill status` cannot confirm it afterwards.
 */
export function skillCell(input: {
  target: SkillTarget
  cliVersion: string | null
  report?: SkillReportLike | null | undefined
  error?: string | null | undefined
  written?: string | null | undefined
}): SkillCell {
  const { target, cliVersion, report, error, written } = input
  if (written) return compare(written, cliVersion)
  if (error) return { kind: "failed", message: error }
  if (!report) return { kind: "checking" }
  if (report.source === "none") return { kind: "unknown" }
  const copy = report.targets.find((t) => t.target === target)
  if (!copy || copy.state === "missing") return { kind: "missing" }
  if (!copy.installed || copy.state === "unversioned") return { kind: "unversioned" }
  if (copy.state === "stale") return { kind: "stale", installed: copy.installed }
  if (copy.state === "current") return { kind: "current", installed: copy.installed }
  return compare(copy.installed, cliVersion)
}

/** The one action a cell offers, if any. */
export function cellAction(cell: SkillCell): "Install" | "Update" | null {
  switch (cell.kind) {
    case "missing":
    case "failed":
      return "Install"
    case "stale":
    case "unversioned":
    case "unknown":
      return "Update"
    default:
      return null
  }
}

export const needsUpdate = (cell: SkillCell) => cell.kind === "stale" || cell.kind === "unversioned"
