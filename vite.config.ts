import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import pkg from "./package.json" with { type: "json" }

const host = process.env.TAURI_DEV_HOST

// Tells a stale launcher build from a fresh one; a source tarball without git builds without it.
function gitStamp() {
  try {
    const [commit, date] = execFileSync("git", ["log", "-1", "--format=%h%n%cs"], { encoding: "utf8" })
      .trim()
      .split("\n")
    return { commit: commit || null, date: date || null }
  } catch {
    return { commit: null, date: null }
  }
}
const stamp = gitStamp()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_COMMIT__: JSON.stringify(stamp.commit),
    __BUILD_DATE__: JSON.stringify(stamp.date),
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Tauri expects a fixed port and prints Rust errors that a cleared screen would hide.
  clearScreen: false,
  server: {
    // VITE_PORT lets a second checkout run its browser build while the app holds 1420.
    port: Number(process.env.VITE_PORT ?? 1420),
    strictPort: true,
    host: host || false,
    ...(host ? { hmr: { protocol: "ws", host, port: 1421 } } : {}),
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15",
    minify: process.env.TAURI_ENV_DEBUG ? false : "oxc",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
})
