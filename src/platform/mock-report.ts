import type { Platform } from "./types"

// `?report=fail` makes the server unreachable, `?report=queued` stores without an issue yet.
const mode = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("report")
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const reportMock: Pick<Platform, "reportContext" | "sendReport"> = {
  async reportContext() {
    await delay(700)
    return {
      app: { name: "wirecat-desktop", version: "0.1.0" },
      system: { os: "Linux", arch: "x86_64", node: "24.19.0", npm: "11.6.2" },
      tools: [
        { id: "tg", version: "0.88.0", manager: "pnpm" },
        { id: "zm", version: "0.42.0", manager: "pnpm" },
      ],
      attachments: {
        runs: [
          {
            tool: "tg",
            runs: [
              { run_id: "20261025T113409Z-chats-list-ccf6d5", command: "chats list", error_code: "rate_limited" },
              { run_id: "20261025T101502Z-sync-1a2b3c", command: "sync", error_code: "timeout" },
            ],
          },
        ],
      },
    }
  },
  async sendReport() {
    await delay(900)
    if (mode === "fail") throw new Error("Could not reach the WireCat server: connection refused")
    if (mode === "queued") return { id: "rep_01JB7Q", issueNumber: null, issueUrl: null }
    return { id: "rep_01JB7Q", issueNumber: 42, issueUrl: "https://github.com/WireCatLabs/wirecat-desktop/issues/42" }
  },
}
