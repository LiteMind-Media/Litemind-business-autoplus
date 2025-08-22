"use client";

// Parlay Proz Instance Dashboard (migrated from original root / page)
// NOTE: This is a trimmed copy (placeholder) of the previous instance code.
// TODO: Reintegrate full functionality or extract shared hooks.

import CustomerTable from "@/components/CustomerTable";
import CustomerCards from "@/components/CustomerCards";
import CustomerCardsGrouped from "@/components/CustomerCardsGrouped";
import KanbanPipeline from "@/components/KanbanPipeline";
import CustomerModal from "@/components/CustomerModal";
import AnalyticsOverview from "@/components/AnalyticsOverview";
import { Customer, SOURCE_OPTIONS, FIRST_CALL_STATUS_OPTIONS, SECOND_CALL_STATUS_OPTIONS, FINAL_STATUS_OPTIONS } from "@/types/customer";
import { BarChart3, Workflow, Search, Filter, CheckSquare, Square, Settings, Trophy } from 'lucide-react';
import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useCustomers } from '@/hooks/useCustomers';
import InstanceSidebar from '@/components/InstanceSidebar';
import ProfileMenu from '@/components/ProfileMenu';
import { computeLeadNumbers } from '@/utils/leads';
import { useBrandSettings } from '@/hooks/useBrandSettings';

export default function ParlayProzInstance() {
    const asStr = useCallback((v: unknown): string => (v ?? "").toString(), []);
    const asSource = useCallback((v: unknown): Customer['source'] => { const s = asStr(v) as Customer['source']; return (SOURCE_OPTIONS as readonly string[]).includes(s) ? s : ''; }, [asStr]);
    const asFirstStatus = useCallback((v: unknown): Customer['firstCallStatus'] => { const s = asStr(v) as Customer['firstCallStatus']; return (FIRST_CALL_STATUS_OPTIONS as readonly string[]).includes(s) ? s : ''; }, [asStr]);
    const asSecondStatus = useCallback((v: unknown): Customer['secondCallStatus'] => { const s = asStr(v) as Customer['secondCallStatus']; return (SECOND_CALL_STATUS_OPTIONS as readonly string[]).includes(s) ? s : ''; }, [asStr]);
    const asFinalStatus = useCallback((v: unknown): Customer['finalStatus'] => { const s = asStr(v) as Customer['finalStatus']; return (FINAL_STATUS_OPTIONS as readonly string[]).includes(s) ? s : ''; }, [asStr]);

    const { customers, updateCustomer, bulkUpdate, undo, redo, canUndo, canRedo, metrics } = useCustomers({ instance: 'parlay-pros' });
    const [view, setView] = useState<'dashboard' | 'table' | 'cards' | 'grouped' | 'registered' | 'analytics' | 'kanban' | 'settings'>('dashboard');
    const allowedViews = useRef(new Set(['dashboard', 'table', 'cards', 'grouped', 'registered', 'analytics', 'kanban', 'settings']));
    const hydratedView = useRef(false);
    useEffect(() => {
        // Restore last view on mount
        try {
            const saved = localStorage.getItem('pp_last_view');
            if (saved && allowedViews.current.has(saved)) {
                setView(saved as any);
            }
        } catch { }
        hydratedView.current = true;
    }, []);
    useEffect(() => {
        if (!hydratedView.current) return; // avoid overwriting during initial mount before restore
        try { localStorage.setItem('pp_last_view', view); } catch { }
    }, [view]);
    // Selection state (declared early so changeView can reference clearSelection safely)
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);
    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    // Per-view scroll position retention
    const scrollPositions = useRef<Record<string, number>>({});
    const pendingRestore = useRef(false);

    // Restore scroll position after view changes
    useEffect(() => {
        if (!pendingRestore.current) return;
        pendingRestore.current = false;
        const y = scrollPositions.current[view] ?? 0;
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'auto' })));
    }, [view]);

    const changeView = useCallback((next: string) => {
        if (next === view) return;
        scrollPositions.current[view] = window.scrollY;
        pendingRestore.current = true;
        setView(next as any);
        clearSelection();
    }, [view, clearSelection]);
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [anchorFilter, setAnchorFilter] = useState(false);
    const [filterSource, setFilterSource] = useState<string>('');
    const [filterFinal, setFilterFinal] = useState<string>('');
    const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
    const openCustomer = customers.find(c => c.id === openCustomerId) || null;

    // Brand identity (name, logo, favicon) with local persistence
    const [brandName, setBrandName] = useState<string>('Parlay Proz');
    const [brandLogoHorizontal, setBrandLogoHorizontal] = useState<string>('');
    const [brandLogoVertical, setBrandLogoVertical] = useState<string>('');
    const [brandLogoIcon, setBrandLogoIcon] = useState<string>('');
    const [brandLogoVariant, setBrandLogoVariant] = useState<'text' | 'horizontal' | 'vertical' | 'icon' | 'icon-text'>('text');
    const [brandLogoSize, setBrandLogoSize] = useState<number>(1); // scale multiplier
    const [brandFavicon, setBrandFavicon] = useState<string>(''); // data URL (png or ico)
    // Domain settings (instance domain + landing / form endpoints)
    const [domainPrimary, setDomainPrimary] = useState<string>('');
    const [domainLanding, setDomainLanding] = useState<string>('');
    const [domainFormEndpoint, setDomainFormEndpoint] = useState<string>('');
    const [domainApiBase, setDomainApiBase] = useState<string>('');
    const [hydratedBrand, setHydratedBrand] = useState(false);
    const { brand: remoteBrand, setBrand: saveRemoteBrand } = useBrandSettings();
    // Merge: prefer remote once loaded; local acts as bootstrap. If remote empty and we have local, push it once.
    const pushedRemoteRef = useRef(false);
    useLayoutEffect(() => {
        // Pre-paint hydration of brand identity to avoid flicker & mismatches
        try {
            const n = localStorage.getItem('pp_brand_name'); if (n) setBrandName(n);
            const lh = localStorage.getItem('pp_brand_logo_horizontal'); if (lh) setBrandLogoHorizontal(lh);
            const lv = localStorage.getItem('pp_brand_logo_vertical'); if (lv) setBrandLogoVertical(lv);
            const li = localStorage.getItem('pp_brand_logo_icon'); if (li) setBrandLogoIcon(li);
            const lvSel = localStorage.getItem('pp_brand_logo_variant'); if (['horizontal', 'vertical', 'icon', 'text', 'icon-text'].includes(lvSel || '')) setBrandLogoVariant(lvSel as any);
            const ls = localStorage.getItem('pp_brand_logo_size'); if (ls && !isNaN(Number(ls))) setBrandLogoSize(Math.min(2, Math.max(0.4, Number(ls))));
            const legacy = localStorage.getItem('pp_brand_logo');
            if (legacy && !lh && !lv && !li) { setBrandLogoHorizontal(legacy); }
            const f = localStorage.getItem('pp_brand_favicon'); if (f) setBrandFavicon(f);
            // Domain settings hydration
            const dp = localStorage.getItem('pp_domain_primary'); if (dp) setDomainPrimary(dp);
            const dl = localStorage.getItem('pp_domain_landing'); if (dl) setDomainLanding(dl);
            const df = localStorage.getItem('pp_domain_form'); if (df) setDomainFormEndpoint(df);
            const da = localStorage.getItem('pp_domain_api'); if (da) setDomainApiBase(da);
    } catch { }
    setHydratedBrand(true);
    }, []);
    // Apply remote brand when available
    useEffect(() => {
        if (!remoteBrand) return;
        if (remoteBrand.name && remoteBrand.name !== brandName) setBrandName(remoteBrand.name);
        // (logos & favicon future: remote fields)
    }, [remoteBrand]);
    // Push local bootstrap to remote once if remote absent
    useEffect(()=> {
        if (pushedRemoteRef.current) return;
        if (remoteBrand === undefined) return; // still loading
        if (remoteBrand === null) {
            saveRemoteBrand({ name: brandName }).catch(()=>{});
            pushedRemoteRef.current = true;
        }
    }, [remoteBrand, brandName, saveRemoteBrand]);
    useEffect(() => { try { localStorage.setItem('pp_brand_name', brandName || ''); } catch { } saveRemoteBrand({ name: brandName }).catch(()=>{}); }, [brandName, saveRemoteBrand]);
    useEffect(() => { try { brandLogoHorizontal ? localStorage.setItem('pp_brand_logo_horizontal', brandLogoHorizontal) : localStorage.removeItem('pp_brand_logo_horizontal'); } catch { } }, [brandLogoHorizontal]);
    useEffect(() => { try { brandLogoVertical ? localStorage.setItem('pp_brand_logo_vertical', brandLogoVertical) : localStorage.removeItem('pp_brand_logo_vertical'); } catch { } }, [brandLogoVertical]);
    useEffect(() => { try { brandLogoIcon ? localStorage.setItem('pp_brand_logo_icon', brandLogoIcon) : localStorage.removeItem('pp_brand_logo_icon'); } catch { } }, [brandLogoIcon]);
    useEffect(() => { try { localStorage.setItem('pp_brand_logo_variant', brandLogoVariant); } catch { } }, [brandLogoVariant]);
    useEffect(() => { try { localStorage.setItem('pp_brand_logo_size', String(brandLogoSize)); } catch { } }, [brandLogoSize]);
    useEffect(() => { try { brandFavicon ? localStorage.setItem('pp_brand_favicon', brandFavicon) : localStorage.removeItem('pp_brand_favicon'); } catch { } }, [brandFavicon]);
    // Domain persistence
    useEffect(() => { try { domainPrimary ? localStorage.setItem('pp_domain_primary', domainPrimary) : localStorage.removeItem('pp_domain_primary'); } catch { } }, [domainPrimary]);
    useEffect(() => { try { domainLanding ? localStorage.setItem('pp_domain_landing', domainLanding) : localStorage.removeItem('pp_domain_landing'); } catch { } }, [domainLanding]);
    useEffect(() => { try { domainFormEndpoint ? localStorage.setItem('pp_domain_form', domainFormEndpoint) : localStorage.removeItem('pp_domain_form'); } catch { } }, [domainFormEndpoint]);
    useEffect(() => { try { domainApiBase ? localStorage.setItem('pp_domain_api', domainApiBase) : localStorage.removeItem('pp_domain_api'); } catch { } }, [domainApiBase]);
    // Update document title & favicon dynamically
    useEffect(() => { document.title = (brandName ? brandName : 'Parlay Proz') + ' Dashboard'; }, [brandName]);
    useEffect(() => {
        if (!brandFavicon) return; // if user clears we leave existing static favicon
        try {
            let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = brandFavicon;
        } catch { }
    }, [brandFavicon]);

    const sorted = useMemo(() => {
        let list = [...customers];
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(c => (c.name + c.phone + (c.email || '') + c.notes + c.secondCallNotes + c.finalNotes).toLowerCase().includes(q));
        }
        if (filterSource) list = list.filter(c => c.source === filterSource);
        if (filterFinal) list = list.filter(c => c.finalStatus === filterFinal);
        return list;
    }, [customers, search, filterSource, filterFinal]);
    // Global (absolute) lead numbering based on full customer set, not filtered subset.
    const globalLeadNumbers = useMemo(() => computeLeadNumbers(customers), [customers]);
    const registered = useMemo(() => metrics.registered, [metrics]);

    const { theme, ready: themeReady, updateTheme, setPreset, presets, customStatusColors, updateStatusColor, exportTheme, importTheme } = useTheme();
    const darkMode = theme.key === 'black';
    const leadControlViews = new Set(['table', 'grouped', 'registered', 'kanban']);
    const showLeadControls = leadControlViews.has(view);
    const showJumpTo = new Set(['table', 'grouped', 'registered']).has(view); // All Leads, Daily Leads, Customers
    // Jump-to-date state (used for Daily Leads vs Registrations chart highlighting / scroll)
    const [jumpDate, setJumpDate] = useState<string>('');
    const [showJumpPicker, setShowJumpPicker] = useState(false);
    // When jumpDate changes, attempt smooth scroll to element id
    useEffect(() => {
        if (!jumpDate) return;
        const el = document.getElementById('day-' + jumpDate);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            // brief flash highlight via class toggle
            el.classList.add('ring-2', 'ring-[var(--brand-from)]');
            setTimeout(() => { el.classList.remove('ring-2', 'ring-[var(--brand-from)]'); }, 1800);
        }
    }, [jumpDate]);
    // Hydration-safe theme variables: use server-known defaults until themeReady to avoid mismatch
    const fallbackTheme = { from: '#FCC843', via: '#F8B846', to: '#F59E0B', text: '#1a1026', background: '#F9FAFB', sidebarText: '#1a1026', headerText: '#1a1026' };
    const tv = themeReady ? theme : fallbackTheme;
    return (
        <main suppressHydrationWarning className={`min-h-screen font-sans flex ${darkMode ? 'bg-[#0F1115] text-white' : 'bg-[radial-gradient(circle_at_30%_20%,var(--brand-bg),transparent_60%)] bg-gradient-to-br from-white via-[var(--brand-bg)] to-[var(--brand-bg)]'}`}
            style={{ ['--brand-from' as any]: tv.from, ['--brand-via' as any]: tv.via, ['--brand-to' as any]: tv.to, ['--brand-text' as any]: tv.text, ['--brand-bg' as any]: tv.background, ['--brand-sidebar-text' as any]: tv.sidebarText, ['--brand-header-text' as any]: tv.headerText }}>
            {!themeReady && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-white dark:bg-[#0F1115] transition-opacity">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-24 h-24">
                            <div className="absolute inset-0 rounded-full border-[6px] border-t-transparent animate-spin" style={{ borderColor: 'var(--brand-from)', borderTopColor: 'transparent' }} />
                            <div className="absolute inset-3 rounded-full border-[6px] border-b-transparent animate-[spin_1.6s_linear_infinite_reverse]" style={{ borderColor: 'var(--brand-to)', borderBottomColor: 'transparent' }} />
                        </div>
                        <div className="text-xs font-bold tracking-[0.3em] text-center uppercase" style={{ color: 'var(--brand-header-text)' }}>Loading Parlay&nbsp;Proz</div>
                    </div>
                </div>
            )}
            <InstanceSidebar view={view} onChange={changeView} />
            <div className="flex-1 min-w-0 flex flex-col">
                <header className="sticky top-0 z-40 bg-white border-b border-black/5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]" style={{ color: 'var(--brand-header-text)' }}>
                    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
                        <div style={{ visibility: hydratedBrand ? 'visible' : 'hidden' }} suppressHydrationWarning>
                            {(() => {
                                const map: Record<string, string> = { horizontal: brandLogoHorizontal, vertical: brandLogoVertical, icon: brandLogoIcon };
                                const selected = brandLogoVariant === 'text' || brandLogoVariant === 'icon-text' ? '' : map[brandLogoVariant];
                                const iconForCombo = brandLogoVariant === 'icon-text' ? map.icon : '';
                                const showText = brandLogoVariant === 'icon-text' ? true : !selected;
                                const base = (brandLogoVariant === 'icon' || brandLogoVariant === 'icon-text') ? 36 : 40; // base px
                                const h = Math.round(base * brandLogoSize);
                                return (
                                    <h1 className="flex items-center gap-3 text-xl md:text-2xl font-black tracking-tight select-none">
                                        {iconForCombo && <img src={iconForCombo} alt="Icon" style={{ height: h, width: h }} className="object-contain" />}
                                        {selected && !iconForCombo && <img src={selected} alt="Logo" style={{ height: h, width: brandLogoVariant === 'icon' ? h : 'auto', maxHeight: 160, maxWidth: 320 }} className={`object-contain ${brandLogoVariant === 'icon' ? '' : 'max-w-[260px]'}`} />}
                                        {showText && <span className="bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-transparent bg-clip-text leading-none drop-shadow-sm">{brandName || 'Brand'}</span>}
                                    </h1>
                                );
                            })()}
                        </div>
                        <div className="flex-1" />
                        <div className="flex items-center gap-2">
                            {showLeadControls && (
                                <>
                                    <div className="relative w-56">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70" />
                                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads or customers" className="w-full h-10 pl-8 pr-3 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur ring-1 ring-white/60 text-[12px] font-medium placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)]" />
                                    </div>
                                    <div className="relative">
                                        <button onClick={() => setAnchorFilter(o => !o)} className={`h-10 px-3 rounded-xl flex items-center gap-2 text-[11px] font-semibold ring-1 ring-white/60 backdrop-blur ${anchorFilter ? 'bg-[var(--brand-from)]/20' : 'bg-white/60 hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/20'}`}><Filter size={14} />Filter</button>
                                        {anchorFilter && (
                                            <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl bg-white/90 backdrop-blur-xl ring-1 ring-black/5 shadow-xl p-4 flex flex-col gap-4 text-[12px] font-medium" style={{ color: '#1a1026' }}>
                                                <div className="space-y-2">
                                                    <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#2e1b40' }}>Source</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <FilterChip label="All" active={!filterSource} onClick={() => setFilterSource('')} />
                                                        {SOURCE_OPTIONS.map(s => <FilterChip key={s} label={s} active={filterSource === s} onClick={() => setFilterSource(s)} />)}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#2e1b40' }}>Final Status</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <FilterChip label="All" active={!filterFinal} onClick={() => setFilterFinal('')} />
                                                        {FINAL_STATUS_OPTIONS.map(s => <FilterChip key={s} label={s} active={filterFinal === s} onClick={() => setFilterFinal(s)} />)}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-2">
                                                    <button onClick={() => { setFilterSource(''); setFilterFinal(''); }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60">Reset</button>
                                                    <button onClick={() => setAnchorFilter(false)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white shadow">Done</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 pl-2 ml-2 border-l border-white/40">
                                        {/* Jump To Date Button */}
                                        {showJumpTo && (
                                            <div className="relative">
                                                <button onClick={() => setShowJumpPicker(o => !o)} className="h-10 px-3 rounded-xl text-[11px] font-semibold bg-white/60 hover:bg-white ring-1 ring-white/60 flex items-center gap-2" style={{ color: '#1a1026' }}>
                                                    Jump To
                                                </button>
                                                {showJumpPicker && (
                                                    <div className="absolute right-0 mt-2 z-50 w-56 p-4 rounded-2xl bg-white/95 backdrop-blur-xl ring-1 ring-black/5 shadow-xl flex flex-col gap-3">
                                                        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#2e1b40' }}>Select Date</div>
                                                        <input
                                                            type="date"
                                                            value={jumpDate}
                                                            onChange={e => { setJumpDate(e.target.value); setShowJumpPicker(false); }}
                                                            min={(() => { try { const all = document.querySelectorAll('[data-day]'); if (all.length) { return (all[0] as HTMLElement).getAttribute('data-day') || ''; } } catch { } return ''; })()}
                                                            max={(() => { try { const all = document.querySelectorAll('[data-day]'); if (all.length) { return (all[all.length - 1] as HTMLElement).getAttribute('data-day') || ''; } } catch { } return ''; })()}
                                                            className="h-10 w-full rounded-xl bg-white/70 ring-1 ring-white/60 px-3 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)]"
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setShowJumpPicker(false)} className="px-3 h-9 rounded-lg text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60">Close</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <button disabled={!canUndo} onClick={undo} className={`h-10 px-3 rounded-xl text-[11px] font-semibold ${canUndo ? 'bg-white/70 hover:bg-white ring-1 ring-white/70' : 'opacity-40 cursor-not-allowed bg-white/40'}`} style={canUndo ? { color: '#1a1026' } : undefined}>Undo</button>
                                        <button disabled={!canRedo} onClick={redo} className={`h-10 px-3 rounded-xl text-[11px] font-semibold ${canRedo ? 'bg-white/70 hover:bg-white ring-1 ring-white/70' : 'opacity-40 cursor-not-allowed bg-white/40'}`} style={canRedo ? { color: '#1a1026' } : undefined}>Redo</button>
                                        <div className="relative">
                                            <button onClick={() => { setSelectionMode(m => !m); if (selectionMode) clearSelection(); }} className={`h-10 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-2 bg-white/60 hover:bg-white ring-1 ring-white/70 ${selectionMode ? '!bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white ring-0' : ''}`}>{selectionMode ? <CheckSquare size={14} /> : <Square size={14} />} {selectionMode ? `${selectedIds.size} Selected` : 'Select'}</button>
                                            {selectionMode && selectedIds.size > 0 && (
                                                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white/90 backdrop-blur-xl ring-1 ring-black/5 shadow-xl p-4 z-50 text-[12px] font-medium flex flex-col gap-4" style={{ color: '#1a1026' }}>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#1a1026' }}>Bulk Actions</span>
                                                        <button onClick={clearSelection} className="text-[11px] font-semibold" style={{ color: '#2e1b40' }} >Clear</button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <BulkBtn label="Mark Interested" onClick={() => { bulkUpdate(Array.from(selectedIds), { firstCallStatus: 'Interested' as any }); }} />
                                                        <BulkBtn label="Mark Answered" onClick={() => { bulkUpdate(Array.from(selectedIds), { firstCallStatus: 'Answered' as any }); }} />
                                                        <BulkBtn label="Final Registered" onClick={() => { bulkUpdate(Array.from(selectedIds), { finalStatus: 'Registered' as any }); }} />
                                                        <BulkBtn label="Final Not Reg" onClick={() => { bulkUpdate(Array.from(selectedIds), { finalStatus: 'Not Registered' as any }); }} />
                                                        <BulkBtn label="Final Follow-up" onClick={() => { bulkUpdate(Array.from(selectedIds), { finalStatus: 'Follow-up Needed' as any }); }} />
                                                        <BulkBtn label="Clear Final" onClick={() => { bulkUpdate(Array.from(selectedIds), { finalStatus: '' as any }); }} />
                                                    </div>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => setSelectionMode(false)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60">Close</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                            <ProfileMenu />
                        </div>
                    </div>
                </header>
                <div className="max-w-[1700px] mx-auto px-5 md:px-8 lg:px-10 pt-6 pb-12 space-y-8 w-full">
                    {view === 'dashboard' && (
                        <DashboardPanel customers={customers} metrics={metrics} />
                    )}
                    {view === 'kanban' && (
                        <div className="rounded-3xl bg-white/55 backdrop-blur-xl ring-1 ring-white/60 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08),0_1px_0_0_rgba(255,255,255,0.6)_inset] p-6 md:p-7">
                            <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
                                <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: '#1a1026' }}>Overview</h2>
                                <div className="text-[11px] font-medium rounded-full px-3 py-1 ring-1" style={{ color: '#2e1b40', background: '#ede9fe', borderColor: '#c4b5fd' }}>v1 Lite Build</div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                                <Metric label="Total Leads" value={sorted.length} />
                                <Metric label="Registered" value={registered} />
                                <Metric label="Views" value={6} />
                                <Metric label="Version" value={1} formatter={() => 'Lite'} />
                            </div>
                        </div>
                    )}
                    <div className="rounded-3xl bg-white/60 backdrop-blur-xl ring-1 ring-white/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] p-4 md:p-6 min-h-[40vh] transition">
                        {(() => {
                            const base = view === 'registered' ? sorted.filter(c => c.finalStatus === 'Registered') : sorted;
                            if (view === 'table') return <CustomerTable leadNumbers={globalLeadNumbers} mode="compact" onOpenCustomer={(id) => setOpenCustomerId(id)} data={base} onUpdateCustomer={updateCustomer} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} onVisibleIdsChange={() => { }} />;
                            if (view === 'cards') return <CustomerCards leadNumbers={globalLeadNumbers} data={base} onUpdateCustomer={updateCustomer} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />;
                            if (view === 'grouped') return <CustomerCardsGrouped leadNumbers={globalLeadNumbers} data={base} onUpdateCustomer={updateCustomer} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />;
                            if (view === 'registered') return <CustomerCards leadNumbers={globalLeadNumbers} data={base} onUpdateCustomer={updateCustomer} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />;
                            if (view === 'kanban') return <KanbanPipeline leadNumbers={globalLeadNumbers} data={base} onUpdateCustomer={updateCustomer} selectedIds={selectedIds} onToggleSelect={toggleSelect} onOpen={(id) => setOpenCustomerId(id)} />;
                            if (view === 'analytics') return <AnalyticsOverview data={sorted} />;
                            if (view === 'settings') return <SettingsPanel theme={theme} presets={presets} setPreset={setPreset} updateTheme={updateTheme} customStatusColors={customStatusColors} updateStatusColor={updateStatusColor} exportTheme={exportTheme} importTheme={importTheme}
                                brandName={brandName} setBrandName={setBrandName}
                                brandLogoHorizontal={brandLogoHorizontal} setBrandLogoHorizontal={setBrandLogoHorizontal}
                                brandLogoVertical={brandLogoVertical} setBrandLogoVertical={setBrandLogoVertical}
                                brandLogoIcon={brandLogoIcon} setBrandLogoIcon={setBrandLogoIcon}
                                brandLogoVariant={brandLogoVariant} setBrandLogoVariant={setBrandLogoVariant}
                                brandLogoSize={brandLogoSize} setBrandLogoSize={setBrandLogoSize}
                                brandFavicon={brandFavicon} setBrandFavicon={setBrandFavicon}
                                domainPrimary={domainPrimary} setDomainPrimary={setDomainPrimary}
                                domainLanding={domainLanding} setDomainLanding={setDomainLanding}
                                domainFormEndpoint={domainFormEndpoint} setDomainFormEndpoint={setDomainFormEndpoint}
                                domainApiBase={domainApiBase} setDomainApiBase={setDomainApiBase}
                            />;
                            return null;
                        })()}
                    </div>
                </div>
            </div>
            {openCustomer && <CustomerModal customer={openCustomer} onClose={() => setOpenCustomerId(null)} onUpdate={updateCustomer} />}
        </main>
    );
}

function Metric({ label, value, formatter }: { label: string; value: number; formatter?: (v: number) => string }) {
    const display = formatter ? formatter(value) : value.toLocaleString();
    return (
        <div className="rounded-xl border border-gray-200 bg-white/60 p-4 flex flex-col items-center gap-1">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{label}</div>
            <div className="text-lg font-bold text-gray-800 tabular-nums">{display}</div>
        </div>
    );
}

// Main Dashboard panel with goal tracking & progress analytics lite
function DashboardPanel({ customers, metrics }: { customers: Customer[]; metrics: any }) {
    // Initialize with neutral values (avoid SSR vs client mismatch); load persisted values after mount
    const [goalChiefAim, setGoalChiefAim] = useState<number>(0);
    const [goalSweetSpot, setGoalSweetSpot] = useState<number>(0);
    const [goalWin, setGoalWin] = useState<number>(0);
    const [goalPresets, setGoalPresets] = useState<{ name: string; value: number }[]>([]);
    const [hydratedGoals, setHydratedGoals] = useState(false);
    useEffect(() => {
        try {
            // Migration: legacy single goal
            const legacy = localStorage.getItem('pp_goal_registered');
            const chief = localStorage.getItem('pp_goal_chief');
            const sweet = localStorage.getItem('pp_goal_sweet');
            const win = localStorage.getItem('pp_goal_win');
            if (chief) setGoalChiefAim(Number(chief) || 0); else if (legacy) setGoalChiefAim(Number(legacy) || 0);
            if (sweet) setGoalSweetSpot(Number(sweet) || 0);
            if (win) setGoalWin(Number(win) || 0);
            const rawPresets = localStorage.getItem('pp_goal_presets');
            if (rawPresets) setGoalPresets(JSON.parse(rawPresets));
        } catch { }
        setHydratedGoals(true);
    }, []);
    // Chief affirmation (editable ribbon) persistence
    const defaultAffirmation = "I AM SO HAPPY AND GRATEFUL NOW THAT PALI PROS HAS 10,000 ACTIVE MEMBERS GOING STRONG AND ONLY INCREASING.";
    const [affirmation, setAffirmation] = useState<string>(defaultAffirmation);
    useEffect(() => {
        try {
            const stored = localStorage.getItem('pp_goal_chief_affirmation');
            if (stored && stored.trim()) setAffirmation(stored);
        } catch { }
    }, []);
    useEffect(() => { try { localStorage.setItem('pp_goal_chief_affirmation', affirmation); } catch { } }, [affirmation]);
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetValue, setNewPresetValue] = useState('');
    useEffect(() => { try { localStorage.setItem('pp_goal_chief', String(goalChiefAim || 0)); } catch { } }, [goalChiefAim]);
    useEffect(() => { try { localStorage.setItem('pp_goal_sweet', String(goalSweetSpot || 0)); } catch { } }, [goalSweetSpot]);
    useEffect(() => { try { localStorage.setItem('pp_goal_win', String(goalWin || 0)); } catch { } }, [goalWin]);
    useEffect(() => { try { localStorage.setItem('pp_goal_presets', JSON.stringify(goalPresets)); } catch { } }, [goalPresets]);
    const registered = metrics.registered ?? customers.filter(c => c.finalStatus === 'Registered').length;
    const progressChief = goalChiefAim > 0 ? Math.min(1, registered / goalChiefAim) : 0;
    const progressSweet = goalSweetSpot > 0 ? Math.min(1, registered / goalSweetSpot) : 0;
    const progressWin = goalWin > 0 ? Math.min(1, registered / goalWin) : 0;
    // Anchor 'now' post-mount to prevent SSR/client date divergence (hydration mismatch)
    const [now, setNow] = useState<Date | null>(null);
    useEffect(() => { setNow(new Date()); }, []);
    const todayRef = now || new Date('2000-01-01'); // placeholder stable on server
    const isISO = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const recent7 = useMemo(() => {
        if (!now) return [] as { date: string; count: number }[]; // defer until hydrated
        // Aggregate registrations by date (last 7 days)
        const today = todayRef;
        const days: { date: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today); d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            days.push({ date: key, count: 0 });
        }
        customers.forEach(c => {
            if (c.finalStatus === 'Registered' && isISO(c.finalCallDate)) {
                const idx = days.findIndex(d => d.date === c.finalCallDate);
                if (idx >= 0) days[idx].count += 1;
            }
        });
        return days;
    }, [customers, now]);
    const maxDay = Math.max(1, ...recent7.map(d => d.count));
    // 30 day cumulative + daily leads vs regs
    const last30 = useMemo(() => {
        if (!now) return [] as { date: string; leads: number; regs: number; cumulativeRegs: number }[];
        const today = todayRef;
        const arr: { date: string; leads: number; regs: number; cumulativeRegs: number }[] = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today); d.setDate(d.getDate() - i); const key = d.toISOString().slice(0, 10);
            arr.push({ date: key, leads: 0, regs: 0, cumulativeRegs: 0 });
        }
        customers.forEach(c => {
            const added = c.dateAdded; if (isISO(added)) { const rec = arr.find(r => r.date === added); if (rec) rec.leads += 1; }
            if (c.finalStatus === 'Registered' && isISO(c.finalCallDate)) { const rec2 = arr.find(r => r.date === c.finalCallDate); if (rec2) rec2.regs += 1; }
        });
        let cum = 0; arr.forEach(r => { cum += r.regs; r.cumulativeRegs = cum; });
        return arr;
    }, [customers, now]);
    const maxDailyLeads = Math.max(1, ...last30.map(d => d.leads));
    const maxCum = Math.max(1, ...last30.map(d => d.cumulativeRegs));
    const projectedDays = useMemo(() => {
        if (!goalChiefAim || registered >= goalChiefAim) return 0;
        // simple average of last 14 days registrations
        const recentRegs = last30.slice(-14).reduce((a, b) => a + b.regs, 0);
        const dailyAvg = recentRegs / 14 || 0;
        if (!dailyAvg) return 0; return Math.ceil((goalChiefAim - registered) / dailyAvg);
    }, [goalChiefAim, registered, last30]);
    const targetDate = projectedDays ? new Date(Date.now() + projectedDays * 86400000).toISOString().slice(0, 10) : null;
    // Milestones for chief aim
    const milestonesChief = useMemo(() => goalChiefAim > 0 ? [0.25, 0.5, 0.75, 1].map(r => ({ ratio: r, value: Math.round(goalChiefAim * r), reached: registered >= goalChiefAim * r })) : [], [goalChiefAim, registered]);
    // Cohort retention (weekly)
    const cohortData = useMemo(() => {
        if (!now) return [] as { weekStart: string; total: number; registered: number; rate: number }[];
        const map: Record<string, { total: number; registered: number }> = {};
        customers.forEach(c => {
            if (!isISO(c.dateAdded)) return; const d = new Date(c.dateAdded + 'T00:00:00'); if (isNaN(d.getTime())) return; const day = d.getDay(); // 0 Sun
            const diff = (day + 6) % 7; // convert to Monday-based index
            d.setDate(d.getDate() - diff); const key = d.toISOString().slice(0, 10);
            if (!map[key]) map[key] = { total: 0, registered: 0 };
            map[key].total++; if (c.finalStatus === 'Registered') map[key].registered++;
        });
        const entries = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
        return entries.map(([weekStart, { total, registered }]) => ({ weekStart, total, registered, rate: total ? registered / total : 0 }));
    }, [customers, now]);
    // Lead source conversion
    const sourceConv = useMemo(() => {
        const map: Record<string, { leads: number; regs: number }> = {};
        customers.forEach(c => { const s = c.source || '—'; if (!map[s]) map[s] = { leads: 0, regs: 0 }; map[s].leads++; if (c.finalStatus === 'Registered') map[s].regs++; });
        return Object.entries(map).map(([source, { leads, regs }]) => ({ source, leads, regs, rate: leads ? regs / leads : 0 })).sort((a, b) => b.rate - a.rate);
    }, [customers]);
    // Activity timeline (last 14 days)
    const activityTimeline = useMemo(() => {
        if (!now) return [] as { date: string; newLeads: number; firstStatuses: number; finals: number }[];
        const days: { date: string; newLeads: number; firstStatuses: number; finals: number }[] = [];
        const today = todayRef;
        for (let i = 13; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const key = d.toISOString().slice(0, 10); days.push({ date: key, newLeads: 0, firstStatuses: 0, finals: 0 }); }
        customers.forEach(c => {
            if (isISO(c.dateAdded)) { const rec = days.find(d => d.date === c.dateAdded); if (rec) rec.newLeads++; }
            if (isISO(c.firstCallDate)) { const rec = days.find(d => d.date === c.firstCallDate); if (rec) rec.firstStatuses++; }
            if (isISO(c.finalCallDate) && c.finalStatus === 'Registered') { const rec = days.find(d => d.date === c.finalCallDate); if (rec) rec.finals++; }
        });
        return days;
    }, [customers, now]);
    // Daily call progress metrics (assumptive logic due to absence of explicit scheduling fields)
    const dailyCallProgress = useMemo(() => {
        if (!now) return null;
        const todayKey = todayRef.toISOString().slice(0, 10);
        const isValid = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
        const newLeadsToday = customers.filter(c => c.dateAdded === todayKey).length;
        const firstCallsToday = customers.filter(c => c.firstCallDate === todayKey && c.firstCallStatus).length;
        const secondCallsToday = customers.filter(c => c.secondCallDate === todayKey && c.secondCallStatus).length;
        const finalCallsToday = customers.filter(c => c.finalCallDate === todayKey && c.finalStatus).length;
        const totalCallTouchesToday = firstCallsToday + secondCallsToday + finalCallsToday;
        // Leads needing a call today (very lightweight heuristic): no final outcome AND missing next dated step fully populated
        const toCallToday = customers.filter(c => {
            if (c.finalStatus === 'Registered' || c.finalStatus === 'Not Registered') return false; // finished
            // No first call yet
            if (!isValid(c.firstCallDate)) return true;
            // First call recorded but second not yet attempted
            if (isValid(c.firstCallDate) && !isValid(c.secondCallDate) && !c.finalStatus) return true;
            // Second call recorded but no final disposition yet
            if (isValid(c.secondCallDate) && !isValid(c.finalCallDate) && !c.finalStatus) return true;
            return false;
        }).length;
        return {
            todayKey,
            newLeadsToday,
            firstCallsToday,
            secondCallsToday,
            finalCallsToday,
            totalCallTouchesToday,
            toCallToday,
        };
    }, [customers, now]);
    return (
        <div className="rounded-3xl bg-white/65 backdrop-blur-xl ring-1 ring-white/60 shadow-[0_6px_28px_-6px_rgba(0,0,0,0.12)] p-6 md:p-10 space-y-12">
            {/* Top: Goal Focus */}
            <div className="grid gap-12 lg:grid-cols-12 items-start">
                <div className="lg:col-span-12 rounded-3xl p-6 md:p-8 relative overflow-hidden ring-1 ring-white/60" style={{ background: 'linear-gradient(135deg,var(--brand-card-bg),var(--brand-muted-bg))' }}>
                    <div className="relative flex flex-col gap-4">
                        <div className="order-first"><AffirmationBanner text={affirmation} onChange={setAffirmation} heading="Growth Dashboard" tagline="Where you are → where you want to be." /></div>
                        <div className="flex flex-col 2xl:flex-row 2xl:items-center gap-8">
                            <MultiGoalRadials progressChief={progressChief} progressSweet={progressSweet} progressWin={progressWin} />
                            <div className="flex-1 flex flex-col gap-8">
                                <div className="grid gap-4 md:grid-cols-3 text-[11px] font-semibold">
                                    <GoalStat label="Registered" value={registered.toLocaleString()} accent />
                                    <GoalStat label="Chief Aim" value={goalChiefAim ? goalChiefAim.toLocaleString() : '—'} />
                                    <GoalStat label="Remaining" value={goalChiefAim ? Math.max(0, goalChiefAim - registered).toLocaleString() : '—'} />
                                    <GoalStat label="Sweet Spot" value={goalSweetSpot ? goalSweetSpot.toLocaleString() : '—'} />
                                    <GoalStat label="Guaranteed Win" value={goalWin ? goalWin.toLocaleString() : '—'} />
                                    <GoalStat label="Conv%" value={customers.length ? Math.round((registered / customers.length) * 100) + '%' : '—'} />
                                </div>
                                <div className="grid md:grid-cols-3 gap-6">
                                    <GoalInput label="Guaranteed Win" value={goalWin} setValue={setGoalWin} placeholder="e.g. 500" />
                                    <GoalInput label="Sweet Spot" value={goalSweetSpot} setValue={setGoalSweetSpot} placeholder="e.g. 2500" />
                                    <GoalInput label="Definite Chief Aim" value={goalChiefAim} setValue={setGoalChiefAim} placeholder="e.g. 10000" />
                                </div>
                                <div className="grid md:grid-cols-3 gap-5">
                                    <ProgressMini label="Win" progress={progressWin} colorFrom="var(--brand-from)" colorTo="var(--brand-to)" />
                                    <ProgressMini label="Sweet" progress={progressSweet} colorFrom="var(--brand-via)" colorTo="var(--brand-to)" />
                                    <ProgressMini label="Chief" progress={progressChief} colorFrom="var(--brand-from)" colorTo="var(--brand-via)" />
                                </div>
                                {goalChiefAim > 0 && projectedDays > 0 && <p className="text-[10px]" style={{ color: 'var(--brand-text-secondary)' }}>At your 14‑day pace you may hit chief aim in <strong>{projectedDays}d</strong>.</p>}
                                {goalChiefAim > 0 && (
                                    <div className="mt-1 w-full h-3 rounded-full relative overflow-hidden" style={{ background: 'var(--brand-muted-bg)', border: '1px solid var(--brand-border)' }}>
                                        <div className="absolute inset-y-0 left-0" style={{ width: `${progressChief * 100}%`, background: 'linear-gradient(90deg,var(--brand-from),var(--brand-to))' }} />
                                        {milestonesChief.map(m => (
                                            <div key={m.ratio} className="absolute top-0 bottom-0" style={{ left: `${m.ratio * 100}%` }}>
                                                <div className="w-px h-full" style={{ background: 'var(--brand-border)' }} />
                                                <div className="absolute -top-5 -translate-x-1/2 text-[9px] font-semibold" style={{ color: m.reached ? 'var(--brand-text-primary)' : 'var(--brand-text-secondary)' }}>{Math.round(m.ratio * 100)}%</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-10 grid gap-4 lg:grid-cols-6 md:grid-cols-3 sm:grid-cols-2">
                                    <DashStat compact label="Total Leads" value={customers.length} />
                                    <DashStat compact label="Registered" value={registered} />
                                    <DashStat compact label="Conv%" value={customers.length ? `${Math.round((registered / customers.length) * 100)}%` : '—'} />
                                    <DashStat compact label="Chief Gap" value={goalChiefAim ? Math.max(0, goalChiefAim - registered).toLocaleString() : '—'} />
                                    <DashStat compact label="Daily Avg (14d)" value={(() => { const recent = last30.slice(-14).reduce((a, b) => a + b.regs, 0); return (recent / 14 || 0).toFixed(1); })()} />
                                    <DashStat compact label="Streak" value={(() => { let streak = 0; for (let i = last30.length - 1; i >= 0; i--) { if (last30[i].regs > 0) streak++; else break; } return streak; })()} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Daily Call Progress */}
            {now && dailyCallProgress && (
                <div className="space-y-5">
                    <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-text-secondary)' }}>Daily Call Progress <span className="font-normal tracking-normal normal-case text-[10px] ml-2" style={{ color: 'var(--brand-text-secondary)' }}>({dailyCallProgress.todayKey})</span></h3>
                    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
                        <DashStat label="To Call Today" value={dailyCallProgress.toCallToday} />
                        <DashStat label="New Leads Today" value={dailyCallProgress.newLeadsToday} />
                        <DashStat label="1st Calls Today" value={dailyCallProgress.firstCallsToday} />
                        <DashStat label="2nd Calls Today" value={dailyCallProgress.secondCallsToday} />
                        <DashStat label="Final Outcomes Today" value={dailyCallProgress.finalCallsToday} />
                        <DashStat label="Total Call Touches" value={dailyCallProgress.totalCallTouchesToday} />
                        <DashStat label="Registered" value={registered} compact />
                    </div>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--brand-text-secondary)' }}>Heuristic: "To Call Today" counts leads without a completed final status that are awaiting their next call step. Adjust logic later when explicit scheduling fields are added.</p>
                </div>
            )}
            {/* Defer charts until hydrated to avoid mismatches */}
            {!now && <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>Loading metrics…</div>}
            {now && (
                <>
                    <div className="grid gap-12 xl:grid-cols-2">
                        <div className="space-y-5">
                            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-text-secondary)' }}>Registrations – Last 7 Days</h3>
                            <div className="flex items-end gap-2 h-44">
                                {recent7.map(d => (
                                    <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                                        <div className="w-full rounded-t-md" style={{ background: 'linear-gradient(to top,var(--brand-from),var(--brand-to))', height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? '10px' : '2px', opacity: d.count ? 1 : 0.35 }} />
                                        <div className="text-[9px] font-semibold" style={{ color: 'var(--brand-text-secondary)' }}>{d.date.slice(5)}</div>
                                        <div className="text-[10px] font-bold" style={{ color: 'var(--brand-text-primary)' }}>{d.count || ''}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-5">
                            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-text-secondary)' }}>Status Breakdown</h3>
                            <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold">
                                {['Interested', 'Answered', 'Voicemail', 'They Called', 'We Called', 'Follow-up Needed', 'Not Registered', 'Registered'].map(s => {
                                    const count = customers.filter(c => c.firstCallStatus === s || c.secondCallStatus === s || c.finalStatus === s).length;
                                    const pct = customers.length ? Math.round((count / customers.length) * 100) : 0;
                                    return (
                                        <div key={s} className="rounded-xl px-3 py-2 flex flex-col gap-1" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)' }}>
                                            <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>{s}</span>
                                            <div className="flex items-center justify-between" style={{ color: 'var(--brand-text-primary)' }}><span className="font-bold tabular-nums">{count}</span><span className="text-[10px] font-medium" style={{ color: 'var(--brand-text-secondary)' }}>{pct}%</span></div>
                                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--brand-muted-bg)' }}>
                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,var(--brand-from),var(--brand-to))' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-12 xl:grid-cols-2">
                        <div className="space-y-5">
                            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-text-secondary)' }}>Daily Leads vs Registrations (30d)</h3>
                            <div className="h-56 flex items-end gap-[3px]">
                                {last30.map(d => {
                                    const leadHeight = (d.leads / maxDailyLeads) * 100;
                                    const regHeight = (d.regs / maxDailyLeads) * 100;
                                    return (
                                        <div key={d.date} id={`day-${d.date}`} data-day={d.date} className="flex-1 flex flex-col items-center gap-1">
                                            <div className="w-full flex flex-col justify-end" style={{ height: '120px' }}>
                                                <div style={{ height: leadHeight + '%', background: 'var(--brand-muted-bg)', border: '1px solid var(--brand-border)' }} className="rounded-t-[4px]" />
                                                {d.regs > 0 && <div style={{ height: regHeight + '%', marginTop: '-4px', background: 'linear-gradient(to top,var(--brand-from),var(--brand-to))' }} className="rounded-t-md" />}
                                            </div>
                                            <div className="text-[9px] font-medium" style={{ color: 'var(--brand-text-secondary)' }}>{d.date.slice(5)}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="space-y-5">
                            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-text-secondary)' }}>Cumulative Registrations (30d)</h3>
                            <div className="relative h-56" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', borderRadius: '1.25rem' }}>
                                <svg viewBox="0 0 300 160" className="absolute inset-0 w-full h-full">
                                    <defs>
                                        <linearGradient id="regLine" x1="0" x2="1" y1="0" y2="0">
                                            <stop offset="0%" stopColor="var(--brand-from)" />
                                            <stop offset="60%" stopColor="var(--brand-via)" />
                                            <stop offset="100%" stopColor="var(--brand-to)" />
                                        </linearGradient>
                                    </defs>
                                    {(() => {
                                        if (!last30.length) return null;
                                        const pts = last30.map((d, i) => {
                                            const x = (i / (last30.length - 1)) * 300;
                                            const y = 150 - (d.cumulativeRegs / maxCum) * 140;
                                            return `${x},${y}`;
                                        }).join(' ');
                                        return <polyline fill="none" stroke="url(#regLine)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" points={pts} />;
                                    })()}
                                </svg>
                                <div className="absolute inset-0 flex flex-col">
                                    <div className="flex-1" />
                                    <div className="h-8 flex items-center justify-between px-4 text-[9px] font-medium" style={{ color: 'var(--brand-text-secondary)' }}>
                                        <span>Start</span>
                                        <span>Now</span>
                                    </div>
                                </div>
                                <div className="absolute top-3 right-4 text-[11px] font-semibold" style={{ color: 'var(--brand-text-secondary)' }}>{last30[last30.length - 1]?.cumulativeRegs.toLocaleString()} total</div>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {/* Cohort & Source Conversion */}
            <div className="grid gap-12 xl:grid-cols-2">
                <div className="space-y-5">
                    <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-text-secondary)' }}>Weekly Cohort Retention</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-[11px] font-semibold" style={{ color: 'var(--brand-text-primary)' }}>
                            <thead>
                                <tr style={{ color: 'var(--brand-text-secondary)' }} className="text-[10px] uppercase tracking-wide">
                                    <th className="text-left py-2 pr-4 font-semibold">Week Start</th>
                                    <th className="text-left py-2 pr-4 font-semibold">Leads</th>
                                    <th className="text-left py-2 pr-4 font-semibold">Registered</th>
                                    <th className="text-left py-2 pr-4 font-semibold">Rate</th>
                                    <th className="text-left py-2 font-semibold">Bar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cohortData.slice(-8).map(c => (
                                    <tr key={c.weekStart} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                                        <td className="py-2 pr-4 tabular-nums">{c.weekStart}</td>
                                        <td className="py-2 pr-4 tabular-nums">{c.total}</td>
                                        <td className="py-2 pr-4 tabular-nums">{c.registered}</td>
                                        <td className="py-2 pr-4 tabular-nums">{Math.round(c.rate * 100)}%</td>
                                        <td className="py-2">
                                            <div className="h-2 w-40 rounded-full overflow-hidden" style={{ background: 'var(--brand-muted-bg)' }}>
                                                <div className="h-full" style={{ width: `${c.rate * 100}%`, background: 'linear-gradient(90deg,var(--brand-from),var(--brand-to))' }} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!cohortData.length && <tr><td colSpan={5} className="py-6 text-center text-[10px]" style={{ color: 'var(--brand-text-secondary)' }}>No cohort data yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="space-y-5">
                    <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-text-secondary)' }}>Lead Source Conversion</h3>
                    <div className="grid gap-3">
                        {sourceConv.map(s => (
                            <div key={s.source} className="flex items-center gap-4 rounded-xl px-4 py-3" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)' }}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between text-[11px] font-semibold">
                                        <span style={{ color: 'var(--brand-text-primary)' }}>{s.source}</span>
                                        <span style={{ color: 'var(--brand-text-secondary)' }}>{Math.round(s.rate * 100)}%</span>
                                    </div>
                                    <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: 'var(--brand-muted-bg)' }}>
                                        <div className="h-full" style={{ width: `${s.rate * 100}%`, background: 'linear-gradient(90deg,var(--brand-from),var(--brand-to))' }} />
                                    </div>
                                    <div className="mt-1 text-[10px] font-medium" style={{ color: 'var(--brand-text-secondary)' }}>{s.regs.toLocaleString()} / {s.leads.toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                        {!sourceConv.length && <div className="text-[10px] font-medium" style={{ color: 'var(--brand-text-secondary)' }}>No sources yet.</div>}
                    </div>
                </div>
            </div>
            {/* Activity Timeline */}
            <div className="space-y-5">
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-text-secondary)' }}>Activity Timeline (14d)</h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                    {activityTimeline.map(d => {
                        const total = d.newLeads + d.firstStatuses + d.finals;
                        return (
                            <div key={d.date} className="min-w-[110px] rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)' }}>
                                <div className="text-[10px] font-semibold" style={{ color: 'var(--brand-text-secondary)' }}>{d.date.slice(5)}</div>
                                <div className="flex flex-col gap-1 text-[10px] font-medium" style={{ color: 'var(--brand-text-primary)' }}>
                                    <span>New: <strong>{d.newLeads}</strong></span>
                                    <span>1st: <strong>{d.firstStatuses}</strong></span>
                                    <span>Reg: <strong>{d.finals}</strong></span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--brand-muted-bg)' }}>
                                    <div className="h-full" style={{ width: (() => { if (!total) return '0%'; const peak = Math.max(1, Math.max(...activityTimeline.map(a => a.newLeads + a.firstStatuses + a.finals))); const pct = Math.min(100, (total / peak) * 100); return pct.toFixed(1) + '%'; })(), background: 'linear-gradient(90deg,var(--brand-from),var(--brand-to))' }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function DashStat({ label, value, compact }: { label: string; value: string | number; compact?: boolean }) {
    // Variant color mapping (label-based, case-insensitive contains match)
    const key = label.toLowerCase();
    const variant = (() => {
        if (key.includes('total')) return { bg: 'linear-gradient(135deg,#6366f1,#3b82f6)', accentFrom: '#6366f1', accentTo: '#3b82f6' };
        if (key.includes('registered')) return { bg: 'linear-gradient(135deg,#059669,#10b981)', accentFrom: '#059669', accentTo: '#10b981' };
        if (key.includes('conv')) return { bg: 'linear-gradient(135deg,#8b5cf6,#ec4899)', accentFrom: '#8b5cf6', accentTo: '#ec4899' };
        if (key.includes('gap')) return { bg: 'linear-gradient(135deg,#ef4444,#f59e0b)', accentFrom: '#ef4444', accentTo: '#f59e0b' };
        if (key.includes('daily')) return { bg: 'linear-gradient(135deg,#0ea5e9,#6366f1)', accentFrom: '#0ea5e9', accentTo: '#6366f1' };
        if (key.includes('streak')) return { bg: 'linear-gradient(135deg,#f59e0b,#ec4899)', accentFrom: '#f59e0b', accentTo: '#ec4899' };
        return { bg: 'linear-gradient(135deg,var(--brand-from),var(--brand-to))', accentFrom: 'var(--brand-from)', accentTo: 'var(--brand-to)' };
    })();
    return (
        <div className={`relative overflow-hidden group rounded-2xl flex flex-col ${compact ? 'px-4 py-3 gap-1' : 'px-5 py-4 gap-1.5'}`} style={{ background: variant.bg, boxShadow: '0 4px 18px -6px rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ background: 'radial-gradient(circle at 30% 25%,#fff,transparent 70%)' }} />
            <div className="absolute -bottom-12 -right-10 w-40 h-40 rounded-full opacity-[0.18] blur-2xl bg-white/40 pointer-events-none" />
            <span className={`relative font-semibold uppercase tracking-wide text-white/70 drop-shadow ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{label}</span>
            {/* Solid readable value text (replacing gradient-clipped text for contrast) */}
            <span className={`relative ${compact ? 'text-lg' : 'text-xl'} font-black tabular-nums text-white`} style={{ textShadow: '0 2px 4px rgba(0,0,0,0.35)' }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
            <div className="absolute inset-0 ring-1 ring-white/20 rounded-2xl pointer-events-none" />
        </div>
    );
}

function GoalStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
    return (
        <div className="rounded-xl px-3 py-2 flex flex-col gap-1" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)' }}>
            <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>{label}</span>
            <span className={`text-sm font-black tabular-nums ${accent ? 'bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-transparent bg-clip-text' : ''}`} style={{ color: accent ? undefined : 'var(--brand-text-primary)' }}>{value}</span>
        </div>
    );
}

function GoalInput({ label, value, setValue, placeholder }: { label: string; value: number; setValue: (n: number) => void; placeholder: string }) {
    return (
        <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>
            {label}
            <input value={value ? value : ''} placeholder={placeholder} onChange={e => { const v = e.target.value.trim(); setValue(v === '' ? 0 : Math.max(0, Number(v) || 0)); }} className="mt-1 h-12 w-full rounded-xl px-3 text-[12px] font-semibold" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-primary)' }} />
        </label>
    );
}

function AffirmationBanner({ text, onChange, heading, tagline }: { text: string; onChange: (v: string) => void; heading: string; tagline: string }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(text);
    useEffect(() => { setDraft(text); }, [text]);
    const handleBlur = () => {
        const val = draft.trim() || text;
        onChange(val.toUpperCase());
        setEditing(false);
    };
    return (
        <div className="relative mt-1 mb-4 group">
            {/* Shimmer removed per request; retained gradient without animation */}
            <div
                className="relative cursor-text flex flex-col lg:flex-row items-start lg:items-stretch gap-6 lg:gap-10 px-0 md:px-2 py-5 md:py-6"
                onClick={() => { if (!editing) { setEditing(true); requestAnimationFrame(() => { const el = document.getElementById('affirmation-textarea'); el?.focus(); }); } }}
            >
                <div className="relative flex flex-col lg:flex-row items-center justify-center gap-10 w-full max-w-[1400px] mx-auto text-center">
                    {/* Heading block */}
                    <div className="flex flex-col gap-3 text-white max-w-[420px] flex-none items-center">
                        <h2
                            className="m-0 font-black tracking-tight bg-clip-text text-transparent text-[30px] md:text-[38px] leading-tight"
                            style={{
                                // Darker, richer violet/indigo range (removed very light ends)
                                backgroundImage: 'linear-gradient(90deg,#7e22ce 0%,#6d28d9 30%,#5b21b6 55%,#4338ca 80%,#4c1d95 100%)'
                            }}
                        >{heading}</h2>
                        <p
                            className="m-0 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.28em] bg-clip-text text-transparent"
                            style={{
                                backgroundImage: 'linear-gradient(90deg,#e9d5ff,#c084fc 55%,#8b5cf6)',
                                textShadow: '0 2px 5px rgba(0,0,0,0.35)',
                                letterSpacing: '0.28em'
                            }}
                        >{tagline}</p>
                    </div>
                    {/* Affirmation text */}
                    <div className="flex-1 min-w-0 flex items-center justify-center">
                        {!editing && (
                            <p
                                className="m-0 font-black tracking-[0.09em] md:tracking-[0.11em] text-[16px] md:text-[22px] 2xl:text-[24px] leading-snug select-none whitespace-pre-wrap break-words bg-clip-text text-transparent max-w-[900px] text-center"
                                style={{
                                    // Darkened affirmation gradient (removed pale lavender/pink endpoints)
                                    backgroundImage: 'linear-gradient(115deg,#6d28d9 0%,#5b21b6 22%,#4c1d95 40%,#4338ca 58%,#3730a3 75%,#312e81 100%)'
                                }}
                            >
                                {text}
                            </p>
                        )}
                        {editing && (
                            <textarea
                                id="affirmation-textarea"
                                value={draft}
                                onChange={e => setDraft(e.target.value)}
                                onBlur={handleBlur}
                                className="w-full max-w-[900px] h-32 md:h-28 bg-white/10 text-purple-200 font-black tracking-[0.09em] md:tracking-[0.11em] text-[16px] md:text-[22px] 2xl:text-[24px] leading-snug p-5 rounded-2xl resize-none outline-none ring-1 ring-purple-300/30 focus:ring-purple-200/60 placeholder:text-purple-200/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_6px_14px_-6px_rgba(0,0,0,0.55)] text-center"
                                style={{ backdropFilter: 'blur(6px)' }}
                                placeholder="TYPE YOUR DEFINITE CHIEF AIM"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProgressMini({ label, progress, colorFrom, colorTo }: { label: string; progress: number; colorFrom: string; colorTo: string }) {
    return (
        <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)' }}>
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>
                <span>{label}</span>
                <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--brand-muted-bg)' }}>
                <div className="h-full" style={{ width: `${progress * 100}%`, background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})` }} />
            </div>
        </div>
    );
}

function RadialProgress({ size, stroke, progress, label, subtitle, id, gradientStops, trackColor }: { size: number; stroke: number; progress: number; label: string; subtitle?: string; id: string; gradientStops: { offset: string; color: string }[]; trackColor?: string }) {
    const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const offset = c - progress * c;
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor || 'var(--brand-border)'} strokeWidth={stroke} fill="none" strokeLinecap="round" />
                <circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#grad-${id})`} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset .7s cubic-bezier(.4,0,.2,1)' }} />
                <defs>
                    <linearGradient id={`grad-${id}`} x1="0" x2="1" y1="0" y2="1">
                        {gradientStops.map(gs => <stop key={gs.offset + gs.color} offset={gs.offset} stopColor={gs.color} />)}
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black leading-none bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg,${gradientStops[0]?.color},${gradientStops[gradientStops.length - 1]?.color})` }}>{label}</span>
                {subtitle && <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>{subtitle}</span>}
            </div>
        </div>
    );
}

function MultiGoalRadials({ progressChief, progressSweet, progressWin }: { progressChief: number; progressSweet: number; progressWin: number }) {
    // Vertical stack with decorative connectors; smaller (Win) -> medium (Sweet) -> large (Chief)
    const winStops = [
        { offset: '0%', color: '#0d9488' },
        { offset: '55%', color: '#14b8a6' },
        { offset: '100%', color: '#10b981' },
    ];
    const sweetStops = [
        { offset: '0%', color: '#f59e0b' },
        { offset: '50%', color: '#f97316' },
        { offset: '100%', color: '#ec4899' },
    ];
    const chiefStops = [
        { offset: '0%', color: 'var(--brand-from)' },
        { offset: '50%', color: 'var(--brand-via)' },
        { offset: '100%', color: 'var(--brand-to)' },
    ];
    return (
        <div className="relative flex flex-col items-center justify-start py-1" style={{ minWidth: 220 }}>
            <RadialProgress id="win" size={90} stroke={8} progress={progressWin} label={`${Math.round(progressWin * 100)}%`} subtitle="Win" gradientStops={winStops} trackColor="#0f766e20" />
            <Connector from="#10b981" to="#f59e0b" height={40} />
            <RadialProgress id="sweet" size={130} stroke={12} progress={progressSweet} label={`${Math.round(progressSweet * 100)}%`} subtitle="Sweet" gradientStops={sweetStops} trackColor="#f59e0b22" />
            <Connector from="#ec4899" to="var(--brand-from)" height={48} />
            <RadialProgress id="chief" size={190} stroke={16} progress={progressChief} label={`${Math.round(progressChief * 100)}%`} subtitle="Chief Aim" gradientStops={chiefStops} trackColor="var(--brand-border)" />
        </div>
    );
}

function Connector({ from, to, height }: { from: string; to: string; height: number }) {
    return (
        <div className="flex items-center justify-center" style={{ height }}>
            <div className="w-1 rounded-full relative" style={{ height: '100%', background: `linear-gradient(to bottom, ${from}, ${to})`, boxShadow: '0 0 0 1px rgba(255,255,255,0.25),0 0 8px -2px rgba(0,0,0,0.4)' }}>
                <div className="absolute inset-0 rounded-full opacity-30 animate-pulse" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.6),transparent)' }} />
            </div>
        </div>
    );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick} className={`px-3 h-8 rounded-full text-[11px] font-semibold ring-1 transition ${active ? 'bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white ring-transparent shadow' : 'bg-white/70 hover:bg-white ring-white/60'}`} style={!active ? { color: '#1a1026' } : undefined}>{label}</button>
    );
}

function BulkBtn({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button onClick={onClick} className="rounded-xl px-3 py-2 text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60 text-left leading-tight" style={{ color: '#1a1026' }}>{label}</button>
    );
}

function SettingsPanel({ theme, presets, setPreset, updateTheme, customStatusColors, updateStatusColor, exportTheme, importTheme, brandName, setBrandName,
    brandLogoHorizontal, setBrandLogoHorizontal,
    brandLogoVertical, setBrandLogoVertical,
    brandLogoIcon, setBrandLogoIcon,
    brandLogoVariant, setBrandLogoVariant,
    brandLogoSize, setBrandLogoSize,
    brandFavicon, setBrandFavicon,
    domainPrimary, setDomainPrimary,
    domainLanding, setDomainLanding,
    domainFormEndpoint, setDomainFormEndpoint,
    domainApiBase, setDomainApiBase }: any) {
    const sections: { key: string; label: string; description?: string }[] = [
        { key: 'identity', label: 'Brand Identity', description: 'Name, logo & favicon' },
        { key: 'domains', label: 'Domains', description: 'Primary & landing URLs' },
        { key: 'brand', label: 'Brand Colors', description: 'Customize gradients and surfaces' },
        { key: 'import', label: 'Import CSV', description: 'Upload leads data' },
        { key: 'export', label: 'Export / Backup', description: 'Download theme & data (coming)' },
        { key: 'appearance', label: 'Appearance', description: 'Layout density & visuals (coming)' },
        { key: 'notifications', label: 'Notifications', description: 'Email / in‑app alerts (coming)' },
        { key: 'goals', label: 'Goals & Affirmation', description: 'Manage goal presets (coming)' },
        { key: 'advanced', label: 'Advanced', description: 'Raw JSON theme & developer tools (coming)' },
    ];
    const [active, setActive] = useState<string>('identity');
    // Base accent pulls from theme, but override to deep violet for Brand section per request
    let accentColor = theme.secondaryText || '#5b21b6';
    if (active === 'brand' || active === 'identity') accentColor = '#1a1026'; // near-black dark violet
    return (
        <div className="flex flex-col lg:flex-row gap-8 p-2">
            {/* Nav */}
            <aside className="w-full lg:w-60 flex-none space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] px-1" style={{ color: accentColor }}>Settings</div>
                <div className="flex lg:flex-col gap-2 flex-wrap">
                    {sections.map(s => {
                        const activeState = s.key === active;
                        return (
                            <button key={s.key} onClick={() => setActive(s.key)}
                                className={`group relative px-4 py-3 rounded-2xl text-left flex-1 lg:flex-none transition shadow-sm ring-1 ${activeState ? 'bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white ring-transparent' : 'bg-white/70 hover:bg-white ring-white/60'}`}
                                style={!activeState ? { color: accentColor } : undefined}
                            >
                                <div className="text-[11px] font-bold tracking-wide uppercase" style={!activeState ? { color: accentColor } : undefined}>{s.label}</div>
                                {s.description && <div className="mt-1 text-[10px] font-medium opacity-70 leading-snug" style={!activeState ? { color: accentColor, opacity: .75 } : undefined}>{s.description}</div>}
                            </button>
                        );
                    })}
                </div>
            </aside>
            {/* Content */}
            <div className="flex-1 min-w-0 space-y-10">
                {active === 'identity' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] mb-4" style={{ color: accentColor }}>Brand Identity</h2>
                            <div className="grid gap-8 md:grid-cols-2">
                                <div className="space-y-5">
                                    <label className="flex flex-col gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>
                                        Brand Name
                                        <input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Enter brand name" className="h-11 px-3 rounded-xl bg-white/70 ring-1 ring-white/60 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)]" />
                                    </label>
                                    <div className="space-y-5">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>Logos (PNG / SVG)</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                            <LogoUploader label="Horizontal" value={brandLogoHorizontal} onChange={setBrandLogoHorizontal} clearLabel="Clear" accentColor={accentColor} aspectHint="Wide header mark" />
                                            <LogoUploader label="Vertical" value={brandLogoVertical} onChange={setBrandLogoVertical} clearLabel="Clear" accentColor={accentColor} aspectHint="Stacked / square mark" square size="large" />
                                            <LogoUploader label="Icon" value={brandLogoIcon} onChange={setBrandLogoIcon} clearLabel="Clear" accentColor={accentColor} aspectHint="Square icon" square size="large" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>Header Display</div>
                                            <div className="flex flex-wrap gap-2">
                                                {(['text', 'horizontal', 'vertical', 'icon', 'icon-text'] as const).map(opt => {
                                                    const labelMap: Record<string, string> = { text: 'Text', horizontal: 'Horizontal', vertical: 'Vertical', icon: 'Icon' };
                                                    labelMap['icon-text'] = 'Icon + Text';
                                                    const active = brandLogoVariant === opt;
                                                    return (
                                                        <button key={opt} type="button" onClick={() => setBrandLogoVariant(opt)}
                                                            className={`px-3 h-9 rounded-xl text-[11px] font-semibold ring-1 transition ${active ? 'bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white ring-transparent shadow' : 'bg-white/70 hover:bg-white ring-white/60'}`}
                                                            style={!active ? { color: accentColor } : undefined}
                                                        >{labelMap[opt]}</button>
                                                    );
                                                })}
                                            </div>
                                            <div className="text-[10px] font-medium opacity-70" style={{ color: accentColor }}>Select which variant renders in the dashboard header. If the chosen logo is missing, the text name will show as fallback.</div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>Header Logo Size</div>
                                                <div className="flex items-center gap-1">
                                                    <button type="button" onClick={() => setBrandLogoSize((s: number) => Math.max(0.4, +(s - 0.1).toFixed(2)))} className="px-2 h-8 rounded-lg text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60" style={{ color: accentColor }}>-</button>
                                                    <button type="button" onClick={() => setBrandLogoSize((s: number) => Math.min(2, +(s + 0.1).toFixed(2)))} className="px-2 h-8 rounded-lg text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60" style={{ color: accentColor }}>+</button>
                                                </div>
                                            </div>
                                            <input type="range" min={0.4} max={2} step={0.1} value={brandLogoSize} onChange={e => setBrandLogoSize(parseFloat(e.target.value))} className="w-full accent-[var(--brand-from)]" />
                                            <div className="text-[10px] font-medium opacity-70 flex items-center justify-between" style={{ color: accentColor }}>
                                                <span>Scale: {brandLogoSize.toFixed(2)}×</span>
                                                <button type="button" onClick={() => setBrandLogoSize(1)} className="text-[10px] font-semibold underline decoration-dotted">Reset</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>Favicon (PNG)</div>
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <div className="w-14 h-14 rounded-xl bg-white/70 ring-1 ring-white/60 flex items-center justify-center overflow-hidden relative">
                                                {brandFavicon ? <img src={brandFavicon} alt="Favicon" className="object-contain max-w-full max-h-full" /> : <span className="text-[9px] font-medium opacity-60">None</span>}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="px-4 h-10 rounded-xl text-[12px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60 flex items-center gap-2 cursor-pointer">Upload
                                                    <input type="file" accept="image/png" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { setBrandFavicon(reader.result as string); }; reader.readAsDataURL(file); }} />
                                                </label>
                                                {brandFavicon && <button type="button" onClick={() => setBrandFavicon('')} className="px-4 h-10 rounded-xl text-[12px] font-semibold bg-white/60 hover:bg-white ring-1 ring-white/60">Clear</button>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="p-5 rounded-2xl bg-white/70 ring-1 ring-white/60 space-y-4">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>Preview</div>
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden">
                                                {brandLogoVariant === 'icon-text' && brandLogoIcon && <img src={brandLogoIcon} alt="Icon" className="object-contain max-w-full max-h-full" />}
                                                {brandLogoVariant !== 'text' && brandLogoVariant !== 'icon-text' && (() => { const map: Record<string, string> = { horizontal: brandLogoHorizontal, vertical: brandLogoVertical, icon: brandLogoIcon }; const src = map[brandLogoVariant]; if (src) return <img src={src} alt="Logo" className="object-contain max-w-full max-h-full" />; return <span className="text-[10px] font-bold opacity-70" style={{ color: accentColor }}>Logo</span>; })()}
                                                {(brandLogoVariant === 'text' || (brandLogoVariant === 'icon-text' && !brandLogoIcon)) && <span className="text-[10px] font-bold opacity-70" style={{ color: accentColor }}>Logo</span>}
                                            </div>
                                            <div className="flex flex-col">
                                                {(brandLogoVariant === 'text' || brandLogoVariant === 'icon-text') && <span className="text-lg font-black bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-transparent bg-clip-text leading-none">{brandName || 'Brand Name'}</span>}
                                                {brandLogoVariant !== 'text' && brandLogoVariant !== 'icon-text' && <span className="text-lg font-black opacity-60" style={{ color: accentColor }}>{brandName || 'Brand Name'}</span>}
                                                <span className="text-[10px] font-medium opacity-70" style={{ color: accentColor }}>Dashboard Heading</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="w-5 h-5 rounded bg-white/80 ring-1 ring-white/60 overflow-hidden">
                                                {brandFavicon ? <img src={brandFavicon} alt="Fav" className="object-contain max-w-full max-h-full" /> : <span className="block text-[8px] font-semibold text-center mt-[3px]" style={{ color: accentColor }}>F</span>}
                                            </span>
                                            <span className="text-[11px] font-medium" style={{ color: accentColor }}>Browser Tab Preview</span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-medium leading-relaxed opacity-80" style={{ color: accentColor }}>
                                        Tips: Provide at least one logo variant. Horizontal works best for wide headers, Vertical for compact sidebars (future), and Icon for favicons / mobile nav. Missing variants gracefully fall back to brand text. Brand settings persist locally.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {active === 'brand' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] mb-4" style={{ color: accentColor }}>Brand Colors</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <ColorInput accentColor={accentColor} label="Gradient From" value={theme.from} onChange={v => updateTheme({ from: v })} />
                                <ColorInput accentColor={accentColor} label="Gradient Via" value={theme.via} onChange={v => updateTheme({ via: v })} />
                                <ColorInput accentColor={accentColor} label="Gradient To" value={theme.to} onChange={v => updateTheme({ to: v })} />
                                <ColorInput accentColor={accentColor} label="Background" value={theme.background} onChange={v => updateTheme({ background: v })} />
                                <ColorInput accentColor={accentColor} label="Sidebar Text" value={theme.sidebarText} onChange={v => updateTheme({ sidebarText: v })} />
                                <ColorInput accentColor={accentColor} label="Header Text" value={theme.headerText} onChange={v => updateTheme({ headerText: v })} />
                                <ColorInput accentColor={accentColor} label="Primary Text" value={theme.primaryText} onChange={v => updateTheme({ primaryText: v })} />
                                <ColorInput accentColor={accentColor} label="Secondary Text" value={theme.secondaryText} onChange={v => updateTheme({ secondaryText: v })} />
                                <ColorInput accentColor={accentColor} label="Border" value={theme.border} onChange={v => updateTheme({ border: v })} />
                                <ColorInput accentColor={accentColor} label="Card BG" value={theme.cardBg} onChange={v => updateTheme({ cardBg: v })} />
                                <ColorInput accentColor={accentColor} label="Muted BG" value={theme.mutedBg} onChange={v => updateTheme({ mutedBg: v })} />
                            </div>
                            <div className="mt-6 flex flex-wrap gap-3 items-center">
                                {Object.entries(presets).map(([k, p]) => {
                                    const preset = p as any as { from: string; via: string; to: string };
                                    return (
                                        <button key={k} onClick={() => setPreset(k)} className="px-3 py-2 rounded-xl text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60 flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${preset.from}, ${preset.via}, ${preset.to})` }} />
                                            {k}
                                        </button>
                                    );
                                })}
                            </div>
                            <ColorSuggestions base={theme.from} onPick={(role, color) => {
                                if (role === 'from') updateTheme({ from: color });
                                if (role === 'via') updateTheme({ via: color });
                                if (role === 'to') updateTheme({ to: color });
                                if (role === 'background') updateTheme({ background: color });
                                if (role === 'border') updateTheme({ border: color });
                                if (role === 'card') updateTheme({ cardBg: color });
                                if (role === 'muted') updateTheme({ mutedBg: color });
                                if (role === 'primaryText') updateTheme({ primaryText: color });
                                if (role === 'secondaryText') updateTheme({ secondaryText: color });
                            }} />
                            <StatusColorEditors customStatusColors={customStatusColors} updateStatusColor={updateStatusColor} />
                            <ThemeIO exportTheme={exportTheme} importTheme={importTheme} />
                            <div className="mt-8 p-5 rounded-2xl bg-white/70 ring-1 ring-white/60">
                                <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: accentColor }}>Preview</div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <span className="text-lg font-black bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-transparent bg-clip-text">Gradient Text</span>
                                    <button className="px-4 h-10 rounded-xl text-[12px] font-semibold text-white bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] shadow">Primary Button</button>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white shadow">Chip</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    // ...existing code...
                )}
                {active === 'domains' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] mb-4" style={{ color: accentColor }}>Domain Settings</h2>
                            <div className="grid gap-6 md:grid-cols-2">
                                <label className="flex flex-col gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>
                                    Primary Domain
                                    <input value={domainPrimary} onChange={e => setDomainPrimary(e.target.value.trim())} placeholder="e.g. app.example.com" className="h-11 px-3 rounded-xl bg-white/70 ring-1 ring-white/60 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)]" />
                                </label>
                                <label className="flex flex-col gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>
                                    Landing / Marketing URL
                                    <input value={domainLanding} onChange={e => setDomainLanding(e.target.value.trim())} placeholder="e.g. www.example.com" className="h-11 px-3 rounded-xl bg-white/70 ring-1 ring-white/60 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)]" />
                                </label>
                                <label className="flex flex-col gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>
                                    Public Form Endpoint
                                    <input value={domainFormEndpoint} onChange={e => setDomainFormEndpoint(e.target.value.trim())} placeholder="e.g. https://www.example.com/signup" className="h-11 px-3 rounded-xl bg-white/70 ring-1 ring-white/60 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)]" />
                                </label>
                                <label className="flex flex-col gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>
                                    API Base URL
                                    <input value={domainApiBase} onChange={e => setDomainApiBase(e.target.value.trim())} placeholder="e.g. https://api.example.com/v1" className="h-11 px-3 rounded-xl bg-white/70 ring-1 ring-white/60 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)]" />
                                </label>
                            </div>
                            <div className="mt-8 p-5 rounded-2xl bg-white/70 ring-1 ring-white/60 space-y-4">
                                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>Preview / Usage</div>
                                <ul className="text-[11px] font-medium leading-relaxed" style={{ color: accentColor }}>
                                    <li><strong>Primary:</strong> {domainPrimary || <em className="opacity-60">not set</em>}</li>
                                    <li><strong>Landing:</strong> {domainLanding || <em className="opacity-60">not set</em>}</li>
                                    <li><strong>Form:</strong> {domainFormEndpoint || <em className="opacity-60">not set</em>}</li>
                                    <li><strong>API:</strong> {domainApiBase || <em className="opacity-60">not set</em>}</li>
                                </ul>
                                <div className="text-[10px] font-medium opacity-70" style={{ color: accentColor }}>
                                    These values are stored locally for now. Future: validation, DNS verification, per-instance multi-domain, and deployment environment overrides.
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {active === 'import' && (
                    <div className="space-y-6">
                        <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: accentColor }}>Import CSV</h2>
                        <p className="text-[11px] font-medium" style={{ color: accentColor, opacity: .85 }}>Upload a CSV of leads to extend your database. (Mapping & validation coming soon.)</p>
                        <label className="flex flex-col items-center justify-center gap-3 h-52 border-2 border-dashed rounded-2xl cursor-pointer bg-white/60 ring-1 ring-white/60 hover:bg-white transition">
                            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
                                const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const text = reader.result as string; const lines = text.split(/\r?\n/).filter(l => l.trim()); alert(`Imported ${lines.length - 1} rows (header assumed).`); } catch { } }; reader.readAsText(file);
                            }} />
                            <span className="text-[12px] font-semibold">Click or Drop CSV</span>
                            <span className="text-[10px] font-medium opacity-60">Max ~5MB • UTF‑8</span>
                        </label>
                    </div>
                )}
                {active === 'export' && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: accentColor }}>Export & Backup</h2>
                        <p className="text-[11px] font-medium" style={{ color: accentColor, opacity: .85 }}>Theme export available now. Data export (CSV / JSON) coming soon.</p>
                        <button onClick={exportTheme} className="px-4 h-11 rounded-xl text-[12px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60">Download Theme JSON</button>
                    </div>
                )}
                {active === 'appearance' && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: accentColor }}>Appearance</h2>
                        <p className="text-[11px] font-medium" style={{ color: accentColor, opacity: .85 }}>Controls for compact mode, number formatting, and animation toggles will appear here.</p>
                    </div>
                )}
                {active === 'notifications' && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: accentColor }}>Notifications</h2>
                        <p className="text-[11px] font-medium" style={{ color: accentColor, opacity: .85 }}>Configure goal progress alerts and daily summary emails (coming).</p>
                    </div>
                )}
                {active === 'goals' && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: accentColor }}>Goals & Affirmation</h2>
                        <p className="text-[11px] font-medium" style={{ color: accentColor, opacity: .85 }}>Planned: saved goal presets, quick switching, and affirmation history.</p>
                    </div>
                )}
                {active === 'advanced' && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: accentColor }}>Advanced</h2>
                        <p className="text-[11px] font-medium" style={{ color: accentColor, opacity: .85 }}>Raw JSON theme editing, experimental feature flags, and data schema diagnostics (future).</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function LogoUploader({ label, value, onChange, clearLabel, accentColor, aspectHint, square, size }: { label: string; value: string; onChange: (v: string) => void; clearLabel?: string; accentColor: string; aspectHint?: string; square?: boolean; size?: 'default' | 'large' }) {
    return (
        <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>{label}</div>
            <div
                className="rounded-2xl flex items-center justify-center overflow-hidden relative"
                style={square ? {
                    width: '100%',
                    aspectRatio: '1 / 1',
                    minHeight: size === 'large' ? '140px' : '110px'
                } : {
                    width: '100%',
                    aspectRatio: '5 / 2',
                    minHeight: '110px'
                }}
            >
                {value ? <img src={value} alt={label} className="object-contain max-w-full max-h-full" /> : <span className="text-[10px] font-medium opacity-60">None</span>}
            </div>
            {aspectHint && <div className="text-[9px] font-medium opacity-60" style={{ color: accentColor }}>{aspectHint}</div>}
            <div className="flex items-center gap-2 flex-wrap">
                <label className="px-3 h-9 rounded-xl text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60 flex items-center gap-2 cursor-pointer">Upload
                    <input type="file" accept="image/png,image/svg+xml" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { onChange(reader.result as string); }; reader.readAsDataURL(file); }} />
                </label>
                {value && <button type="button" onClick={() => onChange('')} className="px-3 h-9 rounded-xl text-[11px] font-semibold bg-white/60 hover:bg-white ring-1 ring-white/60">{clearLabel || 'Clear'}</button>}
            </div>
        </div>
    );
}

function ColorSuggestions({ base, onPick }: { base: string; onPick: (role: string, color: string) => void }) {
    // Simple HSL derive
    const toHSL = (hex: string) => {
        const m = hex.replace('#', '');
        if (m.length !== 6) return { h: 0, s: 0, l: 0 };
        const r = parseInt(m.slice(0, 2), 16) / 255;
        const g = parseInt(m.slice(2, 4), 16) / 255;
        const b = parseInt(m.slice(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2; const d = max - min;
        if (d) { s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break; } h /= 6; }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    };
    const fromHSL = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;
    const hsl = toHSL(base || '#888888');
    const roles = [
        { role: 'from', label: 'From' },
        { role: 'via', label: 'Via' },
        { role: 'to', label: 'To' },
        { role: 'background', label: 'Background' },
        { role: 'border', label: 'Border' },
        { role: 'card', label: 'Card' },
        { role: 'muted', label: 'Muted' },
        { role: 'primaryText', label: 'Primary Text' },
        { role: 'secondaryText', label: 'Secondary Text' },
    ];
    const palette = [
        fromHSL(hsl.h, hsl.s, Math.min(95, hsl.l + 40)),
        fromHSL(hsl.h, hsl.s, Math.min(90, hsl.l + 30)),
        fromHSL(hsl.h, hsl.s, Math.min(80, hsl.l + 20)),
        fromHSL(hsl.h, hsl.s, Math.max(60, hsl.l)),
        fromHSL(hsl.h, Math.min(100, hsl.s + 10), Math.max(45, hsl.l - 10)),
        fromHSL((hsl.h + 30) % 360, hsl.s, hsl.l),
        fromHSL((hsl.h + 180) % 360, hsl.s, hsl.l),
        fromHSL((hsl.h + 210) % 360, hsl.s, hsl.l),
    ];
    return (
        <div className="mt-10 space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#1a1026' }}>Suggestions</div>
            <div className="grid md:grid-cols-2 gap-6">
                {roles.map(r => (
                    <div key={r.role} className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#2e1b40' }}>{r.label}</div>
                        <div className="flex flex-wrap gap-2">
                            {palette.map(p => (
                                <button key={r.role + p} onClick={() => onPick(r.role, p)} className="w-8 h-8 rounded-xl ring-1 ring-white/60 shadow" style={{ background: p }} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatusColorEditors({ customStatusColors, updateStatusColor }: any) {
    const statuses = ['Interested', 'Answered', 'Voicemail', 'They Called', 'We Called', 'Registered', 'Follow-up Needed', 'Not Registered'];
    return (
        <div className="mt-10 space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#1a1026' }}>Status Badge Colors</div>
            <div className="grid md:grid-cols-2 gap-4">
                {statuses.map(s => {
                    const val = customStatusColors[s] || '';
                    return (
                        <label key={s} className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide bg-white/60 rounded-xl px-3 py-2 ring-1 ring-white/60" style={{ color: '#1a1026' }}>
                            <span className="flex-1">{s}</span>
                            <input type="color" value={val || '#ffffff'} onChange={e => updateStatusColor(s, e.target.value)} className="h-9 w-12 p-1 rounded-lg bg-white/70 ring-1 ring-white/60" />
                            <input value={val} onChange={e => updateStatusColor(s, e.target.value)} placeholder="#hex" className="h-9 w-32 px-2 rounded-lg border bg-white/80 text-[11px] font-medium" style={{ borderColor: '#2e1b40' }} />
                            <button type="button" onClick={() => updateStatusColor(s, '')} className="px-2 h-9 rounded-lg text-[10px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60">Reset</button>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

function ThemeIO({ exportTheme, importTheme }: { exportTheme: () => void; importTheme: (f: File) => void }) {
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) importTheme(file); };
    return (
        <div className="mt-10 flex flex-wrap gap-4 items-center">
            <button type="button" onClick={exportTheme} className="px-4 h-10 rounded-xl text-[12px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60">Export Theme</button>
            <label className="px-4 h-10 rounded-xl text-[12px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60 flex items-center gap-2 cursor-pointer">Import Theme
                <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
            </label>
        </div>
    );
}

function ColorInput({ label, value, onChange, accentColor }: { label: string; value: string; onChange: (v: string) => void; accentColor?: string }) {
    const accent = accentColor || '#5b21b6';
    return (
        <label className="flex flex-col gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
            {label}
            <div className="flex items-center gap-3">
                <input
                    type="color"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="h-10 w-14 p-1 rounded-xl bg-white/70 ring-1"
                    style={{ boxShadow: `0 0 0 1px ${accent}` }}
                />
                <input
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-xl border bg-white/80 text-[12px] font-medium"
                    style={{ borderColor: accent + '40' }}
                />
            </div>
        </label>
    );
}
