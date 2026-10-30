import { delay } from "./mock-delay"
import type { Platform, UpdateKind } from "./types"

// `?update=available` offers 0.2.0; `downloading` holds the download at 40%; `fail` stops it halfway with an error.
// A copy from a Linux package: `deb` and `rpm` download it and open the system's installer; `reveal` shows the .deb in
// the file manager instead (no known installer opens it); `signature` is a .deb whose download fails the signature
// check; `other` is a Linux build that does not know how it was installed. No parameter: no update.
const mode = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("update")

const TOTAL = 18_400_000

const kinds: Record<string, UpdateKind> = { deb: "deb", reveal: "deb", signature: "deb", rpm: "rpm", other: "other" }

async function download(onProgress: (p: { downloaded: number; total: number | null }) => void) {
  onProgress({ downloaded: 0, total: TOTAL })
  for (let part = 1; part <= 10; part++) {
    await delay(250)
    if (mode === "downloading" && part === 4) {
      onProgress({ downloaded: (TOTAL * part) / 10, total: TOTAL })
      await new Promise(() => {})
    }
    if (mode === "fail" && part === 5) throw new Error("The download stopped: connection reset")
    onProgress({ downloaded: (TOTAL * part) / 10, total: TOTAL })
  }
}

export const updateMock: Pick<Platform, "checkUpdate" | "installUpdate" | "downloadPackageUpdate" | "restart"> = {
  async checkUpdate() {
    await delay(400)
    if (!mode) return null
    return {
      version: "0.2.0",
      notes: "Sign in to Zoom from the window.\nFaster Storage page.",
      kind: kinds[mode] ?? "self",
    }
  },
  async installUpdate(onProgress) {
    await download(onProgress)
    await delay(600)
  },
  async downloadPackageUpdate(version, onProgress) {
    await download(onProgress)
    if (mode === "signature") return { result: "badSignature" }
    const file = mode === "rpm" ? `wirecat-${version}-1.x86_64.rpm` : `wirecat_${version}_amd64.deb`
    const path = `~/Downloads/${file}`
    const command = `sudo ${mode === "rpm" ? "dnf" : "apt"} install ${path}`
    return { result: "saved", file, path, opened: mode !== "reveal", command }
  },
  async restart() {
    window.location.reload()
  },
}
