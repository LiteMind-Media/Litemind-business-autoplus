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
  // Create background & border tints (very light bg for subtle pastel badge)
  const bgRgb = mixWithWhite(rgb, 0.85);
  const borderRgb = mixWithWhite(rgb, 0.55);
  const bg = toHex(bgRgb);
  const border = toHex(borderRgb);

  // Decide text color based on contrast with background rather than original color.
  const bgLum = luminance(bgRgb);
  const contrast = (lumA: number, lumB: number) => {
    const L1 = Math.max(lumA, lumB);
    const L2 = Math.min(lumA, lumB);
    return (L1 + 0.05) / (L2 + 0.05);
  };
  const darkRgb = { r: 17, g: 24, b: 39 }; // #111827
  const whiteRgb = { r: 255, g: 255, b: 255 };
  const darkLum = luminance(darkRgb);
  const whiteLum = luminance(whiteRgb);
  const contrastDark = contrast(bgLum, darkLum);
  const contrastWhite = contrast(bgLum, whiteLum);
  // Prefer color with higher contrast; bias slightly toward dark text for light pastels
  const text = contrastDark >= contrastWhite * 0.9 ? "#111827" : "#ffffff";
  return { bg, border, text };
}
