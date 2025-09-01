"use client";
import { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, User2 } from 'lucide-react';

export default function ProfileMenu() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, []);
    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setOpen(o => !o)} className="w-10 h-10 rounded-full relative bg-gradient-to-br from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] ring-2 ring-white/70 shadow flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                <span className="drop-shadow">PP</span>
                <span className="absolute inset-0 rounded-full ring-1 ring-white/40" />
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white/90 backdrop-blur-xl ring-1 ring-black/5 shadow-2xl p-2 flex flex-col gap-1 text-sm">
                    <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-header-text)', opacity: 0.7 }}>Account</div>
                    <MenuBtn icon={<User2 size={14} />} label="Profile" />
                    <MenuBtn icon={<Settings size={14} />} label="Settings" />
                    <div className="h-px my-1 bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
                    <MenuBtn icon={<LogOut size={14} />} label="Logout" danger />
                </div>
            )}
        </div>
    );
}
function MenuBtn({ icon, label, danger }: { icon: React.ReactNode; label: string; danger?: boolean }) {
    return (
        <button className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl transition text-[13px] font-medium ${danger ? 'text-red-600 hover:bg-red-50' : 'hover:bg-white/60'}`} style={!danger ? { color: 'var(--brand-header-text)' } : undefined}>{icon}<span>{label}</span></button>
    );
}
