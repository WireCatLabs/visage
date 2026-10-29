/** True when the owner has just dragged over text inside `el`: the click that ends the drag should not act. */
export function selectsTextIn(el: Element): boolean {
  const s = window.getSelection()
  return Boolean(s && !s.isCollapsed && s.toString().trim() && s.anchorNode && el.contains(s.anchorNode))
}
