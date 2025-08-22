// Utility functions for color manipulation & contrast decisions
export function parseHex(
  hex: string
): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function toHex({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function mixWithWhite(
  rgb: { r: number; g: number; b: number },
  ratio: number
): { r: number; g: number; b: number } {
  return {
    r: clamp(rgb.r + (255 - rgb.r) * ratio),
    g: clamp(rgb.g + (255 - rgb.g) * ratio),
    b: clamp(rgb.b + (255 - rgb.b) * ratio),
  };
}

export function mixWithBlack(
  rgb: { r: number; g: number; b: number },
  ratio: number
): { r: number; g: number; b: number } {
  return {
    r: clamp(rgb.r * (1 - ratio)),
    g: clamp(rgb.g * (1 - ratio)),
    b: clamp(rgb.b * (1 - ratio)),
  };
}

export function luminance({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): number {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function deriveBadgePalette(hex: string) {
  const rgb = parseHex(hex);
  if (!rgb) return { bg: hex, border: hex, text: "#111827" };
  const lum = luminance(rgb);
  // Create background & border tints
  const bg = toHex(mixWithWhite(rgb, 0.85));
  const border = toHex(mixWithWhite(rgb, 0.55));
  // Choose text color for contrast; if lum < ~0.55 use white blend
  const text = lum < 0.45 ? toHex(mixWithWhite(rgb, 0.9)) : "#1F2937";
  return { bg, border, text };
}
