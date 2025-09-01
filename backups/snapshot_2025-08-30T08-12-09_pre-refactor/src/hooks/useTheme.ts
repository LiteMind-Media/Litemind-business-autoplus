"use client";
import { useCallback, useEffect, useState } from "react";

export interface BrandTheme {
  from: string; // gradient start
  via: string; // gradient middle
  to: string; // gradient end
  text: string; // gradient-on-light supportive text color
  background: string; // app background (solid or light tint)
  sidebarText: string; // sidebar default text color
  headerText: string; // header default text/icon color
  primaryText: string; // main body text
  secondaryText: string; // subdued text
  border: string; // standard border color
  cardBg: string; // surface background
  mutedBg: string; // subtle background (panels, chips)
  mode?: "light" | "dark"; // color mode
  backgroundRadialCenter?: string; // new radial center color
  backgroundRadialEdge?: string; // new radial edge (fade) color
  key?: string;
}

const STORAGE_KEY = "parlay-theme";

export const PRESET_THEMES: Record<string, BrandTheme> = {
  amber: {
    from: "#FCC843",
    via: "#F8B846",
    to: "#ED9F31",
    text: "#8B5A00",
    background: "#FFF9EF",
    sidebarText: "#8B5A00",
    headerText: "#8B5A00",
    primaryText: "#3A2E12",
    secondaryText: "#8B5A00",
    border: "#F5DFA6",
    cardBg: "#FFFFFF",
    mutedBg: "#FFF3D9",
    key: "amber",
  },
  violet: {
    from: "#6D28D9",
    via: "#7C3AED",
    to: "#8B5CF6",
    text: "#4C1D95",
    background: "#F5F3FF",
    sidebarText: "#4C1D95",
    headerText: "#4C1D95",
    primaryText: "#2E1065",
    secondaryText: "#6D28D9",
    border: "#DDD6FE",
    cardBg: "#FFFFFF",
    mutedBg: "#F1E9FE",
    key: "violet",
  },
  emerald: {
    from: "#059669",
    via: "#10B981",
    to: "#34D399",
    text: "#065F46",
    background: "#ECFDF5",
    sidebarText: "#065F46",
    headerText: "#065F46",
    primaryText: "#064E3B",
    secondaryText: "#059669",
    border: "#A7F3D0",
    cardBg: "#FFFFFF",
    mutedBg: "#DCFCE7",
    key: "emerald",
  },
  blue: {
    from: "#2563EB",
    via: "#3B82F6",
    to: "#60A5FA",
    text: "#1E3A8A",
    background: "#EFF6FF",
    sidebarText: "#1E3A8A",
    headerText: "#1E3A8A",
    primaryText: "#1E3A8A",
    secondaryText: "#2563EB",
    border: "#BFDBFE",
    cardBg: "#FFFFFF",
    mutedBg: "#DBEAFE",
    key: "blue",
  },
  red: {
    from: "#DC2626",
    via: "#EF4444",
    to: "#F87171",
    text: "#7F1D1D",
    background: "#FEF2F2",
    sidebarText: "#7F1D1D",
    headerText: "#7F1D1D",
    primaryText: "#7F1D1D",
    secondaryText: "#B91C1C",
    border: "#FECACA",
    cardBg: "#FFFFFF",
    mutedBg: "#FEE2E2",
    key: "red",
  },
  black: {
    from: "#111827",
    via: "#1F2937",
    to: "#374151",
    text: "#F9FAFB",
    background: "#0F1115",
    sidebarText: "#E5E7EB",
    headerText: "#F9FAFB",
    primaryText: "#F3F4F6",
    secondaryText: "#9CA3AF",
    border: "#374151",
    cardBg: "#1F2937",
    mutedBg: "#111827",
    key: "black",
  },
  teal: {
    from: "#0D9488",
    via: "#14B8A6",
    to: "#2DD4BF",
    text: "#134E4A",
    background: "#F0FDFA",
    sidebarText: "#134E4A",
    headerText: "#134E4A",
    primaryText: "#134E4A",
    secondaryText: "#0D9488",
    border: "#99F6E4",
    cardBg: "#FFFFFF",
    mutedBg: "#CCFBF1",
    key: "teal",
  },
  slate: {
    from: "#475569",
    via: "#64748B",
    to: "#94A3B8",
    text: "#1E293B",
    background: "#F1F5F9",
    sidebarText: "#1E293B",
    headerText: "#1E293B",
    primaryText: "#1E293B",
    secondaryText: "#475569",
    border: "#CBD5E1",
    cardBg: "#FFFFFF",
    mutedBg: "#E2E8F0",
    key: "slate",
  },
};

const defaultTheme: BrandTheme = PRESET_THEMES.amber;

// Removed pre-hydration synchronous localStorage read to avoid SSR/client mismatch.

export function useTheme() {
  const [theme, setTheme] = useState<BrandTheme>(defaultTheme);
  const [customStatusColors, setCustomStatusColors] = useState<
    Record<string, string>
  >({});
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    // Hydrate from localStorage post-mount
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.theme?.from) {
          setTheme((prev) => ({ ...prev, ...parsed.theme }));
          setCustomStatusColors(parsed.statusColors || {});
        } else if (parsed.from && parsed.via) {
          setTheme((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      /* no-op */
    }
    setReady(true);
  }, []);

  const applyThemeVars = useCallback((t: BrandTheme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--brand-from", t.from);
    root.style.setProperty("--brand-via", t.via);
    root.style.setProperty("--brand-to", t.to);
    root.style.setProperty("--brand-text", t.text);
    root.style.setProperty("--brand-bg", t.background);
    root.style.setProperty("--brand-sidebar-text", t.sidebarText);
    root.style.setProperty("--brand-header-text", t.headerText);
    root.style.setProperty("--brand-text-primary", t.primaryText);
    root.style.setProperty("--brand-text-secondary", t.secondaryText);
    root.style.setProperty("--brand-border", t.border);
    root.style.setProperty("--brand-card-bg", t.cardBg);
    root.style.setProperty("--brand-muted-bg", t.mutedBg);
    if (t.backgroundRadialCenter)
      root.style.setProperty("--brand-radial-center", t.backgroundRadialCenter);
    if (t.backgroundRadialEdge)
      root.style.setProperty("--brand-radial-edge", t.backgroundRadialEdge);
    root.dataset.themeMode = t.mode || "light";
  }, []);

  useEffect(() => {
    applyThemeVars(theme);
  }, [theme, applyThemeVars]);

  const updateTheme = (partial: Partial<BrandTheme>) => {
    setTheme((prev) => {
      // If background changes and user didn't explicitly specify a new radial center/edge, auto-link them to the background (binding)
      const linkedPartial: Partial<BrandTheme> = { ...partial };
      if (
        partial.background &&
        !partial.backgroundRadialCenter &&
        !partial.backgroundRadialEdge
      ) {
        const prevCenter = prev.backgroundRadialCenter;
        // Determine if previous radial was auto (matches old background or generic defaults)
        const wasAuto =
          !prevCenter ||
          prevCenter.startsWith(prev.background) ||
          ["#FFFFFF", "#FFFFFFF", "#0F1115", "#0F1115FF"].includes(
            prevCenter.toUpperCase()
          );
        if (wasAuto) {
          const base = partial.background;
          const norm = /^#([0-9a-fA-F]{6})$/.test(base) ? base : "#FFFFFF";
          const mode = partial.mode || prev.mode || "light";
          if (mode === "light") {
            // Both center and edge fully transparent in light mode (delight mode request)
            linkedPartial.backgroundRadialCenter = norm + "00";
            linkedPartial.backgroundRadialEdge = norm + "00";
          } else {
            linkedPartial.backgroundRadialCenter = norm + "FF";
            linkedPartial.backgroundRadialEdge = norm + "00";
          }
        }
      }
      const next = { ...prev, ...linkedPartial, key: undefined };
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ theme: next, statusColors: customStatusColors })
        );
      } catch {}
      return next;
    });
  };

  const toggleMode = () => {
    setTheme((prev) => {
      const dark = prev.mode === "dark";
      let next: BrandTheme;
      // Helper to compute adaptive radial based on current gradient + target mode
      const deriveRadial = (
        t: BrandTheme,
        targetMode: "light" | "dark"
      ): { center: string; edge: string } => {
        // Use appearance background as the anchor instead of gradient stops (brand request)
        const base = t.background || t.via || t.from || "#888888";
        const hex = /^#([0-9a-fA-F]{6})$/.test(base) ? base : "#888888";
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const mix = (c: number, m: number, f: number) =>
          Math.round(c * (1 - f) + m * f);
        if (targetMode === "light") {
          // Light mode: disable radial (fully transparent center & edge)
          const lr = mix(r, 255, 0.82);
          const lg = mix(g, 255, 0.82);
          const lb = mix(b, 255, 0.82);
          const centerBase =
            "#" +
            [lr, lg, lb].map((v) => v.toString(16).padStart(2, "0")).join("");
          const center = centerBase + "00";
          const edge = centerBase + "00";
          return { center, edge };
        } else {
          // Dark: deepen & desaturate toward near-background, keep alpha full center
          const dr = mix(r, 20, 0.65);
          const dg = mix(g, 24, 0.65);
          const db = mix(b, 30, 0.65);
          const center =
            "#" +
            [dr, dg, db].map((v) => v.toString(16).padStart(2, "0")).join("") +
            "FF";
          const edge =
            "#" +
            [dr, dg, db].map((v) => v.toString(16).padStart(2, "0")).join("") +
            "00";
          return { center, edge };
        }
      };
      const shouldAdapt = (t: BrandTheme): boolean => {
        // If user hasn't manually customized (empty or generic white/black defaults)
        const c = t.backgroundRadialCenter?.toUpperCase();
        if (!c) return true;
        if (
          c === "#FFFFFF" ||
          c === "#FFFFFFFF" ||
          c === "#0F1115" ||
          c === "#0F1115FF" ||
          c === "#1E293BFF"
        )
          return true;
        return false;
      };
      if (dark) {
        // switch to light using amber defaults blended with existing gradient
        next = {
          ...prev,
          mode: "light",
          background: "#F9FAFB",
          cardBg: "#ffffff",
          mutedBg: "#f3f4f6",
          border: "#e5e7eb",
          primaryText: "#111827",
          secondaryText: "#6b7280",
          sidebarText: "#374151",
          headerText: "#111827",
          backgroundRadialCenter: prev.backgroundRadialCenter,
          backgroundRadialEdge: prev.backgroundRadialEdge,
        };
        if (shouldAdapt(prev)) {
          const derived = deriveRadial(next, "light");
          next.backgroundRadialCenter = derived.center;
          next.backgroundRadialEdge = derived.edge;
        } else {
          // Ensure alpha parts exist
          if (
            next.backgroundRadialCenter &&
            /^#([0-9a-fA-F]{6})$/.test(next.backgroundRadialCenter)
          )
            next.backgroundRadialCenter += "FF";
          if (
            next.backgroundRadialEdge &&
            /^#([0-9a-fA-F]{6})$/.test(next.backgroundRadialEdge)
          )
            next.backgroundRadialEdge += "00";
        }
      } else {
        // switch to dark using slate/black palette while preserving gradient stops
        next = {
          ...prev,
          mode: "dark",
          background: "#0F1115",
          cardBg: "#1F2937",
          mutedBg: "#111827",
          border: "#374151",
          primaryText: "#F3F4F6",
          secondaryText: "#9CA3AF",
          sidebarText: "#E5E7EB",
          headerText: "#F9FAFB",
          backgroundRadialCenter: prev.backgroundRadialCenter,
          backgroundRadialEdge: prev.backgroundRadialEdge,
        };
        if (shouldAdapt(prev)) {
          const derived = deriveRadial(next, "dark");
          next.backgroundRadialCenter = derived.center;
          next.backgroundRadialEdge = derived.edge;
        } else {
          if (
            next.backgroundRadialCenter &&
            /^#([0-9a-fA-F]{6})$/.test(next.backgroundRadialCenter)
          )
            next.backgroundRadialCenter += "FF";
          if (
            next.backgroundRadialEdge &&
            /^#([0-9a-fA-F]{6})$/.test(next.backgroundRadialEdge)
          )
            next.backgroundRadialEdge += "00";
        }
      }
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ theme: next, statusColors: customStatusColors })
        );
      } catch {}
      return next;
    });
  };

  const setPreset = (key: string) => {
    const preset = PRESET_THEMES[key];
    if (preset) {
      // Preserve current mode; adapt radial background to new gradient if previous was auto/default
      setTheme((prev) => {
        const mode = prev.mode || "light";
        const deriveRadial = (
          t: BrandTheme,
          targetMode: "light" | "dark"
        ): { center: string; edge: string } => {
          const base = t.background || t.via || t.from || "#888888";
          const hex = /^#([0-9a-fA-F]{6})$/.test(base) ? base : "#888888";
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          const mix = (c: number, m: number, f: number) =>
            Math.round(c * (1 - f) + m * f);
          if (targetMode === "light") {
            const lr = mix(r, 255, 0.82);
            const lg = mix(g, 255, 0.82);
            const lb = mix(b, 255, 0.82);
            const baseColor =
              "#" +
              [lr, lg, lb].map((v) => v.toString(16).padStart(2, "0")).join("");
            return { center: baseColor + "00", edge: baseColor + "00" };
          } else {
            const dr = mix(r, 20, 0.65);
            const dg = mix(g, 24, 0.65);
            const db = mix(b, 30, 0.65);
            const center =
              "#" +
              [dr, dg, db]
                .map((v) => v.toString(16).padStart(2, "0"))
                .join("") +
              "FF";
            const edge =
              "#" +
              [dr, dg, db]
                .map((v) => v.toString(16).padStart(2, "0"))
                .join("") +
              "00";
            return { center, edge };
          }
        };
        const shouldAdapt = (t: BrandTheme): boolean => {
          const c = t.backgroundRadialCenter?.toUpperCase();
          if (!c) return true;
          if (
            c === "#FFFFFF" ||
            c === "#FFFFFFFF" ||
            c === "#0F1115" ||
            c === "#0F1115FF" ||
            c === "#1E293BFF"
          )
            return true;
          return false;
        };
        const base: BrandTheme = { ...preset, mode };
        if (shouldAdapt(prev)) {
          const d = deriveRadial(base, mode === "dark" ? "dark" : "light");
          base.backgroundRadialCenter = d.center;
          base.backgroundRadialEdge = d.edge;
        } else {
          // keep previous custom radial colors if user customized
          base.backgroundRadialCenter = prev.backgroundRadialCenter;
          base.backgroundRadialEdge = prev.backgroundRadialEdge;
        }
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ theme: base, statusColors: customStatusColors })
          );
        } catch {}
        return base;
      });
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            theme: { ...preset, mode: theme.mode },
            statusColors: customStatusColors,
          })
        );
      } catch {}
    }
  };

  const updateStatusColor = (key: string, value: string) => {
    setCustomStatusColors((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ theme, statusColors: next })
        );
      } catch {}
      return next;
    });
  };

  const exportTheme = () => {
    const payload = { theme, statusColors: customStatusColors, version: 1 };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parlay-theme-${theme.key || "custom"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTheme = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.theme?.from && parsed.theme?.via) {
          setTheme({ ...defaultTheme, ...parsed.theme });
          setCustomStatusColors(parsed.statusColors || {});
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              theme: { ...defaultTheme, ...parsed.theme },
              statusColors: parsed.statusColors || {},
            })
          );
        }
      } catch {}
    };
    reader.readAsText(file);
  };
  return {
    theme,
    ready,
    updateTheme,
    setPreset,
    presets: PRESET_THEMES,
    customStatusColors,
    updateStatusColor,
    exportTheme,
    importTheme,
    toggleMode,
  };
}
