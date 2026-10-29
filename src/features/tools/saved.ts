import * as v from "valibot"
import { LatestVersionsSchema, ToolStatesSchema } from "@/platform/schemas"

/**
 * The Tools page's last answer, kept for the next app start so the page opens with it while the tools are asked
 * again. Only what the page already shows: versions, `~` paths, the package manager, a masked problem line.
 */
const KEY = "wirecat.tools.last"

const SavedSchema = v.object({ tools: ToolStatesSchema, latest: v.nullable(LatestVersionsSchema) })
export type Saved = v.InferOutput<typeof SavedSchema>

export function readSaved(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Saved | null {
  try {
    const parsed = v.safeParse(SavedSchema, JSON.parse(storage?.getItem(KEY) ?? "null"))
    return parsed.success ? parsed.output : null
  } catch {
    return null
  }
}

export function save(saved: Saved, storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(saved))
  } catch {
    // Without storage the next start simply asks the tools before showing them.
  }
}
