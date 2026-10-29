// Screenshots of the browser build (mock platform) for design review.
//   node scripts/capture.mjs <out.png> [query] [--lang en|ru|es] [--width 1536] [--height 1024] [--dark]
//                                [--wait ms] [--eval "js"] [--port 1420]
// Needs `pnpm dev` running and a local Chrome (CHROME_PATH overrides the path).
import { existsSync } from "node:fs"
import { chromium } from "playwright-core"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args.splice(i, 2)[1]
}
const width = Number(flag("width", 1536))
const height = Number(flag("height", 1024))
const script = flag("eval", null)
const wait = Number(flag("wait", 400))
const port = Number(flag("port", 1420))
const lang = flag("lang", "en")
const dark = args.includes("--dark") ? args.splice(args.indexOf("--dark"), 1) && true : false
const [out, query = ""] = args
if (!out) throw new Error("usage: node scripts/capture.mjs <out.png> [query]")

const candidates = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]
const executablePath = candidates.find((p) => p && existsSync(p))
const browser = await chromium.launch({ executablePath, headless: true })
const page = await browser.newPage({
  viewport: { width, height },
  colorScheme: dark ? "dark" : "light",
  reducedMotion: "reduce",
  locale: "en-US",
})
page.on("pageerror", (e) => console.error("page error:", e.message))
await page.addInitScript(
  (l) => localStorage.setItem("wirecat.language", JSON.stringify({ state: { choice: l } })),
  lang,
)
await page.goto(`http://localhost:${port}/${query}`)
await page.waitForFunction(() => !document.querySelector('[role="status"].skeleton, .skeleton'), null, {
  timeout: 15000,
})
if (script) await page.evaluate(`(async () => { ${script} })()`)
await page.waitForTimeout(wait)
await page.screenshot({ path: out })
await browser.close()
