"use client";
import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { deriveBadgePalette } from '@/utils/color';

const base = "w-full rounded-md border border-gray-200 bg-white/70 backdrop-blur-sm px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition placeholder:text-gray-400";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
    return <input ref={ref} {...props} className={base + ' ' + (props.className || '')} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
    return <select ref={ref} {...props} className={base + ' pr-8 ' + (props.className || '')} />;
});

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(props, ref) {
    return <textarea ref={ref} {...props} className={base + ' min-h-[80px] ' + (props.className || '')} />;
});

export type BadgeColor = 'gray' | 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'pink' | 'cyan' | 'emerald';

// Enhanced status color: returns legacy palette key IF no custom override.
export function statusColor(kind: 'first' | 'second' | 'final', value: string | undefined): BadgeColor | { custom: true; bg: string; border: string; text: string } {
    if (!value) return 'gray';
    // Access custom status colors dynamically – hook inside function wrapper
    try {
        const { customStatusColors } = useTheme();
        const hex = customStatusColors[value];
        if (hex) {
            const pal = deriveBadgePalette(hex);
            return { custom: true, bg: pal.bg, border: pal.border, text: pal.text };
        }
    } catch {
        // ignore hook usage errors if called outside React (should not happen in components)
    }
    if (kind === 'first') {
        if (value === 'Interested') return 'green';
        if (value === 'Answered') return 'blue';
        if (value === 'Voicemail') return 'amber';
        return 'red';
    }
    if (kind === 'second') {
        if (value === 'They Called') return 'purple';
        if (value === 'We Called') return 'cyan';
        if (value === 'Answered') return 'green';
        if (value === 'Voicemail') return 'amber';
        return 'gray';
    }
    if (value === 'Registered') return 'green';
    if (value === 'Follow-up Needed') return 'amber';
    if (value === 'Not Registered') return 'red';
    return 'gray';
}
