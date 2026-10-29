const NAVIGATION = new Set(["Tab", "Escape", "Home", "End", "PageUp", "PageDown"])

/**
 * Marks `<html data-input>` with how the owner last moved: `keyboard` or `pointer`. The browser's own `:focus-visible`
 * keeps the ring on a button clicked after any key press, and on focus that code moves after a click; the stylesheet
 * hides rings while the mode is `pointer`. Typing into a field is not navigation, so it does not bring rings back.
 */
export function trackInputMode(doc: Document = document): () => void {
  const root = doc.documentElement
  const pointer = () => {
    root.dataset.input = "pointer"
  }
  const key = (e: KeyboardEvent) => {
    if (NAVIGATION.has(e.key) || e.key.startsWith("Arrow")) root.dataset.input = "keyboard"
  }
  doc.addEventListener("pointerdown", pointer, true)
  doc.addEventListener("keydown", key, true)
  return () => {
    doc.removeEventListener("pointerdown", pointer, true)
    doc.removeEventListener("keydown", key, true)
  }
}
