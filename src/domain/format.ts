const UNITS = ["bytes", "KB", "MB", "GB", "TB"]

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit]}`
}
