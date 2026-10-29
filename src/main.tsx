import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app/App"
import { ErrorBoundary } from "./app/ErrorBoundary"
import { runMockScenario } from "./app/scenarios"
import { captureErrors } from "./features/report/errors"
import "./styles/index.css"
import { trackInputMode } from "./ui/input-mode"

const root = document.getElementById("root")
if (!root) throw new Error("index.html has no #root")

captureErrors()
trackInputMode()

// The first frame would be laid out in a fallback font, and the swap to the real one re-wraps every paragraph
// (19 px on Logs). The fonts ship with the app, so the wait is a few milliseconds; the cap keeps a broken font
// from holding the window blank.
const FONTS = ["Onest Variable", "Unbounded Variable", "JetBrains Mono Variable"]
// The sample text loads the Latin and Cyrillic files: each is its own unicode-range, fetched only when asked for.
const fonts = Promise.all(FONTS.map((f) => document.fonts.load(`1em "${f}"`, "AaÑñЖж")))
const cap = new Promise((done) => setTimeout(done, 500))

Promise.race([fonts, cap])
  .catch(() => undefined)
  .then(() => {
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary scope="app">
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )
    runMockScenario()
  })
