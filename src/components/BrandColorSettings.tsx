"use client";
import React, { useState } from "react";
import type { BrandTheme } from "@/hooks/useTheme";

interface BrandColorSettingsProps {
    theme: BrandTheme;
    presets: Record<string, BrandTheme>;
    setPreset: (k: string) => void;
    updateTheme: (p: Partial<BrandTheme>) => void;
}

// Small helper for hex validation / normalization
const norm = (v: string): string => {
    if (/^#([0-9a-fA-F]{6})$/.test(v)) return v.toUpperCase();
    return "#000000"; // fallback; UI will show obvious incorrect value
};

const COLOR_FIELDS: { key: keyof BrandTheme; label: string; hint?: string }[] = [
    { key: "from", label: "Gradient From" },
    { key: "via", label: "Gradient Via" },
    { key: "to", label: "Gradient To" },
    { key: "background", label: "App Background", hint: "Base page background" },
    { key: "cardBg", label: "Card Background" },
    { key: "mutedBg", label: "Muted Background" },
    { key: "border", label: "Border" },
    { key: "primaryText", label: "Primary Text" },
    { key: "secondaryText", label: "Secondary Text" },
    { key: "sidebarText", label: "Sidebar Text" },
    { key: "headerText", label: "Header Text" },
];

export function BrandColorSettings({ theme, presets, setPreset, updateTheme }: BrandColorSettingsProps) {
    const [expanded, setExpanded] = useState(true);

    const handle = (k: keyof BrandTheme, value: string) => {
        if (!value) return;
        updateTheme({ [k]: norm(value) } as Partial<BrandTheme>);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-text-primary)' }}>Brand Colors</h2>
                <button onClick={() => setExpanded(e => !e)} className="text-[11px] font-semibold px-3 h-9 rounded-xl bg-white/70 hover:bg-white ring-1 ring-white/60" style={{ color: 'var(--brand-text-secondary)' }}>{expanded ? 'Collapse' : 'Expand'}</button>
            </div>
            {expanded && (
                <>
                    {/* Presets */}
                    <div className="space-y-4">
                        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>Presets</div>
                        <div className="flex flex-wrap gap-2">
                            {Object.keys(presets).map(key => {
                                const p = presets[key];
                                const active = p.from === theme.from && p.to === theme.to && p.via === theme.via;
                                return (
                                    <button key={key}
                                        type="button"
                                        onClick={() => setPreset(key)}
                                        className={`relative px-4 h-10 rounded-xl text-[11px] font-semibold ring-1 transition overflow-hidden ${active ? 'text-white ring-transparent shadow' : 'bg-white/70 hover:bg-white ring-white/60'}`}
                                        style={active ? { background: `linear-gradient(90deg,${p.from},${p.via},${p.to})` } : { color: 'var(--brand-text-secondary)' }}>
                                        <span className="relative z-10 capitalize">{key}</span>
                                        {!active && (
                                            <span aria-hidden className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(90deg,${p.from},${p.via},${p.to})` }} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] font-medium opacity-70 max-w-xl" style={{ color: 'var(--brand-text-secondary)' }}>Choose a starting palette. You can fine‑tune individual colors below; changes are saved automatically to the active instance.</p>
                    </div>
                    {/* Gradient Preview */}
                    <div className="rounded-2xl p-5 ring-1 ring-white/60 bg-white/70 dark:bg-[#1A2330]/70 flex flex-col gap-4">
                        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>Preview</div>
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 h-40 rounded-xl shadow-inner relative overflow-hidden" style={{ background: `linear-gradient(90deg,${theme.from},${theme.via},${theme.to})` }}>
                                <div className="absolute inset-0 grid grid-cols-12 opacity-25" aria-hidden>
                                    {Array.from({ length: 12 }).map((_, i) => <span key={`preview-col-${i}`} className="border-l border-white/40" />)}
                                </div>
                            </div>
                            <div className="flex-1 grid grid-cols-3 sm:grid-cols-4 gap-3 text-[10px] font-medium">
                                {(['background', 'cardBg', 'mutedBg', 'border', 'primaryText', 'secondaryText', 'sidebarText', 'headerText'] as (keyof BrandTheme)[]).map(k => {
                                    const val = theme[k];
                                    return (
                                        <div key={k} className="rounded-lg p-2 ring-1 ring-black/10 flex flex-col gap-2 items-center" style={{ background: k.includes('Text') ? '#ffffff' : 'var(--brand-card-bg)' }}>
                                            <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>{k}</span>
                                            <span className="w-8 h-8 rounded-md shadow-inner ring-1 ring-black/10" style={{ background: val }} />
                                            <span className="text-[9px] font-mono" style={{ color: 'var(--brand-text-secondary)', maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    {/* Editors */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {COLOR_FIELDS.map(f => {
                            const value = theme[f.key];
                            return (
                                <label key={f.key} className="flex flex-col gap-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>
                                    {f.label}
                                    <div className="flex items-center gap-3">
                                        <input type="color" value={value} onChange={e => handle(f.key, e.target.value)} className="h-12 w-14 rounded-xl cursor-pointer bg-transparent border border-white/60" />
                                        <input value={value} onChange={e => handle(f.key, e.target.value)} className="flex-1 h-12 px-3 rounded-xl bg-white/70 ring-1 ring-white/60 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)]" />
                                    </div>
                                    {f.hint && <span className="text-[9px] font-medium opacity-60 normal-case" style={{ color: 'var(--brand-text-secondary)' }}>{f.hint}</span>}
                                </label>
                            );
                        })}
                    </div>
                    <div className="text-[10px] font-medium opacity-70" style={{ color: 'var(--brand-text-secondary)' }}>Tip: Keep good contrast (WCAG) between background & text colors. Gradients only use From/Via/To; surfaces & text can be tuned independently.</div>
                </>
            )}
        </div>
    );
}

export default BrandColorSettings;
