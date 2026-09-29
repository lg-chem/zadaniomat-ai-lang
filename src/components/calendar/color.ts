// "#rrggbb" (or "#rgb") with transparency; other color formats are returned unchanged
export function withAlpha(color: string, alpha: number): string {
  let hex = color.trim()
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
  }
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return color
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
  return `${hex}${a}`
}

// Dark text on light event colors (e.g. yellow), white text otherwise
export function readableTextColor(color: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(color)
  if (!match) return "#ffffff"
  const [r, g, b] = match.slice(1).map((v) => parseInt(v, 16))
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.7 ? "#1f2937" : "#ffffff"
}
