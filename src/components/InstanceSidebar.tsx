"use client";
import { BarChart3, Workflow, Users2, Table, LayoutGrid, CalendarDays, Settings, LayoutDashboard } from 'lucide-react';
import React from 'react';

interface NavItem { key: string; label: string; icon: React.ReactNode; }
const items: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { key: 'table', label: 'All Leads', icon: <Table size={16} /> },
    { key: 'grouped', label: 'Daily Leads', icon: <CalendarDays size={16} /> },
    { key: 'registered', label: 'Customers', icon: <Users2 size={16} /> },
    { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
    { key: 'kanban', label: 'Pipeline', icon: <Workflow size={16} /> },
    { key: 'settings', label: 'Settings', icon: <Settings size={16} /> },
];

export function InstanceSidebar({ view, onChange }: { view: string; onChange: (v: string) => void }) {
    return (
        <aside className="hidden md:flex flex-col w-52 shrink-0 pt-[4.5rem] pb-6 px-4 gap-6 bg-white/55 dark:bg-white/10 backdrop-blur-xl ring-1 ring-white/60 rounded-r-3xl shadow-[0_4px_18px_-4px_rgba(0,0,0,0.1)] h-screen sticky top-0 overflow-y-auto">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] px-2" style={{ color: 'var(--brand-sidebar-text)' }}>Dashboards</div>
            <nav className="flex flex-col gap-1">
                {items.map(it => {
                    const active = it.key === view;
                    return (
                        <button
                            key={it.key}
                            onClick={() => onChange(it.key)}
                            className={`group relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 ring-amber-500/60`}
                        >
                            <span className={`absolute inset-0 rounded-xl transition ${active ? 'bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] shadow-[0_2px_6px_-2px_rgba(0,0,0,0.3)]' : 'bg-transparent group-hover:bg-white/50'}`} />
                            <span className="relative z-10 flex items-center gap-2" style={{ color: active ? '#FFFFFF' : 'var(--brand-sidebar-text)' }}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center ${active ? 'text-white' : ''}`}>{it.icon}</span>
                                <span className={`relative ${active ? 'text-white' : ''}`}>{it.label}</span>
                            </span>
                        </button>
                    );
                })}
            </nav>
            <div className="mt-auto pt-4 border-t border-white/50 text-[10px] px-2 leading-relaxed" style={{ color: 'var(--brand-sidebar-text)' }}>
                <p className="font-semibold">Keyboard</p>
                <p><kbd className="px-1.5 py-0.5 bg-white/70 rounded border text-[9px] mr-1">1</kbd>Table</p>
                <p><kbd className="px-1.5 py-0.5 bg-white/70 rounded border text-[9px] mr-1">2</kbd>Cards</p>
            </div>
        </aside>
    );
}
export default InstanceSidebar;
