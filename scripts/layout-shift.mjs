// Layout shift of every page while it loads, on the browser build (mock platform).
//   pnpm build && pnpm preview --port 1478 --strictPort      (the dev server adds a shift of its own as CSS loads)
//   node scripts/layout-shift.mjs [page…] --port 1478 [--lang en|ru|es] [--slow 1] [--width 1536] [--height 1024]
//                                 [--dark]
//                                 [--sources 5] [--shots ms,ms,…] [--out dir] [--budget 0.01] [--grow 8]
// Pages: tools tools-manage agents agents-revisit storage logs settings settings-telegram onboarding-<step> report
// (default: all).
// Needs a local Chrome.
// Prints the Cumulative Layout Shift (CLS: the sum of every shift's score, 0 = nothing moved) per page, and the
// elements that moved most, with when and how far. CLS misses a block growing at the bottom (nothing below it
// moves), so "grew" adds up how far the visible part of the page grew after its first frame, in pixels: a skeleton
// at the final size scores 0, one row too short scores that row. Below the window's edge does not count.
// `--slow 3` stretches every mock wait; `--shots` saves a screenshot at each of those moments after the page opens.
// Exits 1 when a page's CLS is above `--budget` or it grew more than `--grow` pixels, so it can guard a fixed page.
import { existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium } from "playwright-core"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args.splice(i, 2)[1]
}
// No default: 1420 is usually the dev server of another checkout, which would measure the wrong code.
const port = Number(flag("port", 0))
if (!port) throw new Error("--port is required: pnpm build && pnpm preview --port <port> --strictPort")
const slow = Number(flag("slow", 1))
const width = Number(flag("width", 1536))
const height = Number(flag("height", 1024))
const top = Number(flag("sources", 5))
const shots = flag("shots", "").split(",").filter(Boolean).map(Number)
const out = flag("out", join(tmpdir(), "layout-shift"))
const budget = Number(flag("budget", 0.01))
const growBudget = Number(flag("grow", 8))
// The interface language; pages that click a button by its English text need the default, en.
const lang = flag("lang", "en")
const dark = args.includes("--dark") ? args.splice(args.indexOf("--dark"), 1) && true : false

// A page opens from a query; `clicks` then go through to a state behind it, each after the page before has settled.
// Only what happens after the last step is scored, so `settings` measures Settings, not the Tools page it starts on.
const nav = (id) => `nav button[data-tour="nav-${id}"]`
// By position, not by text, so every --lang finds them.
const manage = '[data-tour="tool-action"] button[aria-expanded] >> nth=0'
const PAGES = {
  tools: { query: "?onboarding=off&section=tools" },
  "tools-manage": { query: "?onboarding=off&section=tools", clicks: [manage] },
  "tools-mcp": {
    query: "?onboarding=off&section=tools",
    clicks: [manage, '[data-tour="mcp-server"]'],
  },
  agents: { query: "?onboarding=off&section=agents" },
  "agents-revisit": { query: "?onboarding=off&section=agents", clicks: [nav("tools"), nav("agents")] },
  storage: { query: "?onboarding=off&section=storage" },
  logs: { query: "?onboarding=off&section=logs" },
  settings: { query: "?onboarding=off&section=tools", clicks: [nav("settings")] },
  "settings-telegram": {
    query: "?onboarding=off&section=tools",
    clicks: [nav("settings"), 'label:has-text("Telegram")'],
  },
  "onboarding-computer": { query: "?onboarding=computer" },
  "onboarding-choose": { query: "?onboarding=choose" },
  "onboarding-install": { query: "?onboarding=install" },
  "onboarding-agents": { query: "?onboarding=agents" },
  "onboarding-signin": { query: "?onboarding=signin" },
  report: {
    query: "?onboarding=off&section=tools",
    clicks: ['[data-tour="report-problem"]'],
    watch: "dialog[open]",
  },
}
const pages = args.length ? args : Object.keys(PAGES)

// Runs in the page before any app code: records every shift and names the elements that moved.
function observe(watch) {
  const describe = (node) => {
    if (!(node instanceof Element)) return node?.nodeName ?? "?"
    const tag = node.tagName.toLowerCase()
    const data = [...node.attributes]
      .filter((a) => a.name.startsWith("data-") || a.name === "role" || a.name === "aria-label")
      .map((a) => `[${a.name}=${a.value.slice(0, 24)}]`)
      .join("")
    const cls = (node.getAttribute("class") ?? "").split(/\s+/).slice(0, 3).join(".")
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40)
    return `${tag}${data}${cls ? `.${cls}` : ""}${text ? ` "${text}"` : ""}`
  }
  window.__shifts = []
  // The page's visible height every frame, from the moment it is first drawn; `main > *` is the open page, or the
  // page's own `watch` element, such as an open dialog.
  window.__heights = []
  const sample = () => {
    const page = document.querySelector(watch)
    if (page) {
      const box = page.getBoundingClientRect()
      const h = Math.round(Math.max(0, Math.min(box.bottom, window.innerHeight) - box.top))
      if (window.__heights.at(-1)?.h !== h) window.__heights.push({ at: Math.round(performance.now()), h })
    }
    requestAnimationFrame(sample)
  }
  requestAnimationFrame(sample)
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      window.__shifts.push({
        at: Math.round(e.startTime),
        value: e.value,
        sources: e.sources.map((s) => ({
          node: describe(s.node),
          // An element pushed out of the window reports an empty box, which is not a move by minus its position.
          gone: s.currentRect.width === 0 && s.currentRect.height === 0,
          dy: Math.round(s.currentRect.y - s.previousRect.y),
          dh: Math.round(s.currentRect.height - s.previousRect.height),
          dx: Math.round(s.currentRect.x - s.previousRect.x),
        })),
      })
    }
  }).observe({ type: "layout-shift", buffered: true })
}

const candidates = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]
const executablePath = candidates.find((p) => p && existsSync(p))
// Real scrollbars, as the Linux and Windows webviews draw them: one appearing narrows the page by its width.
const browser = await chromium.launch({ executablePath, headless: true, ignoreDefaultArgs: ["--hide-scrollbars"] })
if (shots.length) mkdirSync(out, { recursive: true })

// Settled: no skeleton left and nothing moved for a while, or the page gave up.
async function settle(page) {
  const quiet = 1500 * slow
  const deadline = Date.now() + 20000 * slow
  let last = -1
  let stillSince = Date.now()
  while (Date.now() < deadline) {
    const n = await page.evaluate(
      () =>
        window.__shifts.length +
        window.__heights.length +
        document.querySelectorAll(".skeleton, .skeleton-text").length * 1e6,
    )
    if (n !== last) {
      last = n
      stillSince = Date.now()
    } else if (n < 1e6 && Date.now() - stillSince > quiet) break
    await page.waitForTimeout(100)
  }
}

let over = false
for (const name of pages) {
  const spec = PAGES[name]
  if (!spec) throw new Error(`unknown page ${name}; pages: ${Object.keys(PAGES).join(" ")}`)
  const page = await browser.newPage({
    viewport: { width, height },
    colorScheme: dark ? "dark" : "light",
    reducedMotion: "reduce",
    locale: "en-US",
  })
  page.on("pageerror", (e) => console.error(`${name}: page error:`, e.message))
  await page.addInitScript(
    (l) => localStorage.setItem("wirecat.language", JSON.stringify({ state: { choice: l } })),
    lang,
  )
  await page.addInitScript(observe, spec.watch ?? "main > *")
  await page.goto(`http://localhost:${port}/${spec.query}&slow=${slow}`)
  let started = Date.now()
  for (const selector of spec.clicks ?? []) {
    await settle(page)
    await page.click(selector)
    // What the click itself opens is the owner's doing; only what data does after it counts. A panel opens a frame or
    // two after the click, so the reset waits as long as the browser's own CLS does (500ms after input).
    await page.waitForTimeout(500)
    await page.evaluate(() => {
      window.__shifts = []
      window.__heights = window.__heights.slice(-1)
    })
    started = Date.now()
  }
  for (const ms of shots) {
    await page.waitForTimeout(Math.max(0, ms - (Date.now() - started)))
    await page.screenshot({ path: join(out, `${name}-${String(ms).padStart(5, "0")}.png`) })
  }
  await settle(page)
  const { shifts, heights } = await page.evaluate(() => ({ shifts: window.__shifts, heights: window.__heights }))
  await page.close()

  const cls = shifts.reduce((sum, s) => sum + s.value, 0)
  const grew = heights.slice(1).reduce((sum, x, i) => sum + Math.max(0, x.h - heights[i].h), 0)
  if (cls > budget || grew > growBudget) over = true
  console.log(`\n${name.padEnd(15)} CLS ${cls.toFixed(4)}  shifts ${shifts.length}  grew ${grew}px`)
  if (heights.length > 1) console.log(`  visible      ${heights.map((x) => `${x.h}px@${x.at}ms`).join(" → ")}`)
  const biggest = [...shifts].sort((a, b) => b.value - a.value).slice(0, top)
  for (const s of biggest) {
    console.log(`  ${String(s.at).padStart(6)} ms  ${s.value.toFixed(4)}`)
    for (const src of s.sources.slice(0, 3)) {
      const moved = src.gone
        ? ["out of view"]
        : [src.dy && `dy ${src.dy}`, src.dx && `dx ${src.dx}`, src.dh && `dh ${src.dh}`].filter(Boolean)
      console.log(`             ${moved.join(" ").padEnd(18)} ${src.node}`)
    }
  }
}
await browser.close()
process.exitCode = over ? 1 : 0
