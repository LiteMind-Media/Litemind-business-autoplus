"use client";
import React from 'react';

export default function ThemeProviderClient({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
        if (typeof window === 'undefined') return 'light';
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    return <>{children}</>;
}
