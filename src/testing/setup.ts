import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"
import { useNav } from "@/features/nav"
import { resetKept } from "@/features/tools/kept"
import { useLanguage } from "@/i18n"

afterEach(() => {
  cleanup()
  useNav.setState({ active: "tools" })
  resetKept()
  useLanguage.setState({ choice: "en" })
})

// jsdom has no matchMedia; the theme follows it.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia

// jsdom has <dialog> but not its modal methods.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false
  this.dispatchEvent(new Event("close"))
}

// The suite reads English; a machine set to Russian or Spanish would otherwise switch it.
useLanguage.setState({ choice: "en" })
