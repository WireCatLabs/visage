import { useMemo } from "react"
import { type Fit, fits, storeFile } from "@/domain/compat"
import { installedOf, useCompat } from "./compat-store"
import { useTools } from "./store"

/** Keyed by package owner: Email's fit is Memo's. `undefined` until the tools have answered. */
export function useFits(): { all: Record<string, Fit>; schema: number | null } | undefined {
  const compat = useCompat((s) => s.compat)
  const installs = useTools((s) => s.installs)
  return useMemo(() => {
    if (!compat) return undefined
    const file = storeFile(compat)
    return { all: fits(compat, installedOf(installs)), schema: file?.exists ? file.version : null }
  }, [compat, installs])
}
