"use client";

import React from "react";

type Color = 'gray' | 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'pink' | 'cyan' | 'emerald' | 'themePrimary' | 'themeSecondary';

export default function Badge({ color = 'gray', children }: { color?: Color; children: React.ReactNode }) {
    const map: Record<Color, string> = {
        gray: 'bg-gray-50 text-gray-700 border-gray-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        green: 'bg-green-50 text-green-700 border-green-200',
        red: 'bg-rose-50 text-rose-700 border-rose-200',
        amber: 'bg-amber-50 text-amber-800 border-amber-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
        pink: 'bg-pink-50 text-pink-700 border-pink-200',
        cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        themePrimary: 'border-[var(--brand-border)] text-[var(--brand-text-primary)] bg-[var(--brand-muted-bg)]',
        themeSecondary: 'border-[var(--brand-border)] text-[var(--brand-text-secondary)] bg-[var(--brand-card-bg)]',
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${map[color]}`}>
            {children}
        </span>
    );
}
