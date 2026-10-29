/**
 * The module grid of a QR code the tools print off a terminal (cli-core `plainQr`): two rows per line in half blocks,
 * where a glyph marks a LIGHT module so the code reads dark on light on a dark chat background. The code is square and
 * the drawing includes its quiet zone, so the line width is its size; an odd size leaves a padding half row at the
 * bottom, which is dropped. Null when the text is not such a drawing.
 */
export function qrModules(text: string): boolean[][] | null {
  const lines = text.split("\n").filter((l) => l.length > 0)
  const size = lines[0]?.length ?? 0
  if (size === 0 || lines.some((l) => l.length !== size || /[^█▀▄ ]/.test(l))) return null
  if (lines.length !== Math.ceil(size / 2)) return null
  const dark: boolean[][] = []
  for (const line of lines) {
    const top: boolean[] = []
    const bottom: boolean[] = []
    for (const glyph of line) {
      top.push(glyph !== "█" && glyph !== "▀")
      bottom.push(glyph !== "█" && glyph !== "▄")
    }
    dark.push(top, bottom)
  }
  return dark.slice(0, size)
}

/** One SVG path for every dark module, in module units. */
export function qrPath(dark: boolean[][]): string {
  const parts: string[] = []
  dark.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x]) {
        x++
        continue
      }
      const start = x
      while (row[x]) x++
      parts.push(`M${start} ${y}h${x - start}v1h${start - x}z`)
    }
  })
  return parts.join("")
}
