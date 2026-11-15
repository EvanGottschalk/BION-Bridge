// '#RRGGBB' (or '#RGB') + opacity 0–1 → 'rgba(r,g,b,a)'. Opacity is clamped.
export function withOpacity(hex: string, opacity: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  const a = Math.min(1, Math.max(0, opacity));
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
