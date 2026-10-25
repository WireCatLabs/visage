import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app/App"
import { ErrorBoundary } from "./app/ErrorBoundary"
import { runMockScenario } from "./app/scenarios"
import "./styles/index.css"

const root = document.getElementById("root")
if (!root) throw new Error("index.html has no #root")

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

runMockScenario()
