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
// We'll hydrate theme after mount; overlay in page prevents visible flash.
const syncInitialTheme: BrandTheme | null = null;
const syncInitialStatus: Record<string, string> | null = null;

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
  }, []);

  useEffect(() => {
    applyThemeVars(theme);
  }, [theme, applyThemeVars]);

  const updateTheme = (partial: Partial<BrandTheme>) => {
    setTheme((prev) => {
      const next = { ...prev, ...partial, key: undefined };
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
      setTheme(preset);
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ theme: preset, statusColors: customStatusColors })
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
  };
}
