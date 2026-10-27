// Rule 9 regression on the browser build: opening and closing a tool's Manage panel never moves the row that was
// clicked, and never scrolls the page by itself. Runs at the smallest window, where the page has room to scroll.
//   pnpm build && pnpm preview --port 1478 --strictPort
//   node scripts/scroll-hold.mjs --port 1478 [--width 960] [--height 640]
// Exits 1 when a clicked row moved more than 2px or jumped between two frames by more than 40px.
import { existsSync } from "node:fs"
import { chromium } from "playwright-core"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}
const port = Number(flag("port", 0))
if (!port) throw new Error("--port is required: pnpm build && pnpm preview --port <port> --strictPort")
const width = Number(flag("width", 960))
const height = Number(flag("height", 640))

const executablePath = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium"].find(
  (p) => p && existsSync(p),
)
const browser = await chromium.launch({ executablePath, headless: true })
const page = await browser.newPage({ viewport: { width, height } })
await page.goto(`http://localhost:${port}/?onboarding=off&section=tools`)
await page.waitForSelector('ul[aria-label="WireCat tools"] button:text-is("Manage")')
await page.waitForTimeout(800)

// Clicks run in the page: Playwright's own click scrolls its target into view first, which would hide the bug.
const manageable = await page.$$eval('ul[aria-label="WireCat tools"] > li', (rows) =>
  rows.flatMap((li, i) =>
    [...li.querySelectorAll("button")].some((b) => b.textContent.trim() === "Manage") ? [i] : [],
  ),
)
const [first, last] = [manageable[0], manageable.at(-1)]
const press = (i) =>
  page.evaluate((i) => {
    const li = document.querySelectorAll('ul[aria-label="WireCat tools"] > li')[i]
    ;[...li.querySelectorAll("button")].find((b) => b.textContent.trim() === "Manage").click()
  }, i)
const rowTop = (i) =>
  page.evaluate(
    (i) => document.querySelectorAll('ul[aria-label="WireCat tools"] > li')[i].getBoundingClientRect().top,
    i,
  )
const scrollBy = (dy) => page.evaluate((dy) => (document.querySelector("main").scrollTop += dy), dy)
const scrollRowTo = (i, y) =>
  page.evaluate(
    ([i, y]) => {
      const li = document.querySelectorAll('ul[aria-label="WireCat tools"] > li')[i]
      document.querySelector("main").scrollTop += li.getBoundingClientRect().top - y
    },
    [i, y],
  )

// Samples the row every frame for half a second after the click.
async function watch(i) {
  const before = await rowTop(i)
  await press(i)
  const tops = await page.evaluate(
    (i) =>
      new Promise((done) => {
        const li = document.querySelectorAll('ul[aria-label="WireCat tools"] > li')[i]
        const seen = []
        const end = performance.now() + 500
        const tick = () => {
          seen.push(li.getBoundingClientRect().top)
          if (performance.now() < end) requestAnimationFrame(tick)
          else done(seen)
        }
        requestAnimationFrame(tick)
      }),
    i,
  )
  const jump = Math.max(0, ...tops.slice(1).map((t, k) => Math.abs(t - tops[k])))
  const atTop = await page.evaluate(() => document.querySelector("main").scrollTop === 0)
  return { before, after: tops.at(-1), jump, atTop }
}

const cases = []
await press(last)
await page.waitForTimeout(500)
await scrollBy(200)
cases.push(["close a panel after scrolling into it", await watch(last)])

await page.evaluate(() => (document.querySelector("main").scrollTop = 0))
await press(first)
await page.waitForTimeout(500)
await scrollRowTo(last, height / 2)
cases.push(["open a tool below an open one", await watch(last)])

// The connect guide: after Start the server, the next step is on screen, and the page only ever glides to it.
await page.goto(`http://localhost:${port}/?onboarding=off&section=tools&connect=address&tailscale=ready`)
await page.waitForSelector('button:text-is("Start the server")')
await page.waitForTimeout(800)
const guide = await page.evaluate(
  (y) =>
    new Promise((done) => {
      const m = document.querySelector("main")
      const start = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Start the server")
      m.scrollTop += start.getBoundingClientRect().top - y
      const seen = [m.scrollTop]
      start.click()
      const end = performance.now() + 1500
      const tick = () => {
        seen.push(m.scrollTop)
        if (performance.now() < end) return requestAnimationFrame(tick)
        const box = document.querySelector("h5.step-heading").getBoundingClientRect()
        const view = m.getBoundingClientRect()
        done({ seen, visible: box.top >= view.top && box.bottom <= view.bottom })
      }
      requestAnimationFrame(tick)
    }),
  height / 2,
)
const glide = Math.max(0, ...guide.seen.slice(1).map((t, k) => Math.abs(t - guide.seen[k])))

await browser.close()
const guideOk = guide.visible && glide <= 80
console.log(
  `${guideOk ? "ok  " : "FAIL"} start the server in the connect guide: next step ${guide.visible ? "" : "not "}on ` +
    `screen, largest scroll step between frames ${Math.round(glide)}px`,
)
let failed = !guideOk
for (const [name, r] of cases) {
  const moved = Math.abs(r.after - r.before)
  // With no page above to give back, the row can only slide to its place, never jump.
  const ok = (moved <= 2 || r.atTop) && r.jump <= 40
  failed ||= !ok
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name}: row ${Math.round(r.before)} → ${Math.round(r.after)}px, ` +
      `largest step between frames ${Math.round(r.jump)}px`,
  )
}
process.exit(failed ? 1 : 0)
