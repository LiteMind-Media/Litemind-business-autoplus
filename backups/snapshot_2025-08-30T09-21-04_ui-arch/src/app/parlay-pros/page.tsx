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
import { Customer, SOURCE_OPTIONS, FINAL_STATUS_OPTIONS, FIRST_CALL_STATUS_OPTIONS, SECOND_CALL_STATUS_OPTIONS } from "@/types/customer";
import { Search, Filter, Download, CheckSquare, Square, SlidersHorizontal, X } from 'lucide-react';
import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import Papa from 'papaparse';
import { useMutation } from 'convex/react';
import { api } from '@/../convex/_generated/api';
import { useTheme, BrandTheme } from '@/hooks/useTheme';
import { useCustomers } from '@/hooks/useCustomers';
import InstanceSidebar from '@/components/InstanceSidebar';
import ProfileMenu from '@/components/ProfileMenu';
import { computeLeadNumbers } from '@/utils/leads';
import { useBrandSettings } from '@/hooks/useBrandSettings';
import { useGoals } from '@/hooks/useGoals';
import { useStatusColors } from '@/hooks/useStatusColors';
import { useThemeSettings } from '@/hooks/useThemeSettings';

export default function ParlayProzInstance() {
    // removed unused casting helpers (no dynamic ingestion here)

    const { customers, updateCustomer, bulkUpdate, undo, redo, canUndo, canRedo, metrics, forceSync, remoteCount, uniquePhoneCount } = useCustomers({ instance: 'parlay-pros' });
    const [view, setView] = useState<'dashboard' | 'table' | 'cards' | 'grouped' | 'registered' | 'analytics' | 'kanban' | 'settings'>('dashboard');
    const allowedViews = useRef(new Set(['dashboard', 'table', 'cards', 'grouped', 'registered', 'analytics', 'kanban', 'settings']));
    const hydratedView = useRef(false);
    useEffect(() => {
        // Restore last view on mount
        try {
            const saved = localStorage.getItem('pp_last_view');
            if (saved && allowedViews.current.has(saved)) {
                setView(saved as typeof view);
            }
        } catch { /* noop */ }
        hydratedView.current = true;
    }, []); // runs once on mount
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
        if (!allowedViews.current.has(next) || next === view) return;
        scrollPositions.current[view] = window.scrollY;
        pendingRestore.current = true;
        setView(next as typeof view);
        clearSelection();
    }, [view, clearSelection]);
    const [search, setSearch] = useState('');
    const [showTools, setShowTools] = useState(false);
    // Sidebar animation + accessibility
    const [toolsActive, setToolsActive] = useState(false); // becomes true one frame after mount for CSS transitions
    const undoBtnRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        if (showTools) {
            // next frame so initial translate state applies
            const id = requestAnimationFrame(() => setToolsActive(true));
            // focus first actionable control for accessibility
            setTimeout(() => { undoBtnRef.current?.focus(); }, 120);
            const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowTools(false); };
            window.addEventListener('keydown', onKey);
            return () => { cancelAnimationFrame(id); window.removeEventListener('keydown', onKey); };
        } else {
            // allow transition-out to play before fully resetting active state
            const t = setTimeout(() => setToolsActive(false), 320);
            return () => clearTimeout(t);
        }
    }, [showTools]);
    // Sorting (requested): progress, name, dateAdded, leadNumber (global index). No phone / registered sort.
    const [sortKey, setSortKey] = useState<'progress' | 'name' | 'dateAdded' | 'leadNumber'>('dateAdded');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [anchorFilter, setAnchorFilter] = useState(false);
    const [filterSource, setFilterSource] = useState<string>('');
    const [filterFinal, setFilterFinal] = useState<string>('');
    const [filterFirstCall, setFilterFirstCall] = useState<string>('');
    const [filterSecondCall, setFilterSecondCall] = useState<string>('');
    const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
    const openCustomer = customers.find(c => c.id === openCustomerId) || null;
    // Preserve pagination page for table view (avoid reset to page 1 after edits/modal close)
    const [tablePageIndex, setTablePageIndex] = useState(0);

    // Brand identity (name, logo, favicon) with local persistence
    const [brandName, setBrandName] = useState<string>('Parlay Proz');
    const [brandLogoHorizontal, setBrandLogoHorizontal] = useState<string>('');
    // Dark mode horizontal logo (optional)
    const [brandLogoHorizontalDark, setBrandLogoHorizontalDark] = useState<string>('');
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
    const instanceId = 'parlay-pros';
    const { brand: remoteBrand, setBrand: saveRemoteBrandBase } = useBrandSettings(instanceId);
    // Brand dirty & synchronization guards
    const localBrandDirtyRef = useRef(false); // user edited locally since last successful remote save
    const lastAppliedRemoteBrandUpdatedAt = useRef<string | null>(null); // which remote updatedAt we last applied to local state
    const lastSentBrandHashRef = useRef<string | null>(null); // avoid redundant mutation spam
    const markBrandDirty = () => { localBrandDirtyRef.current = true; };
    type BrandSavePayload = {
        name?: string; logoHorizontal?: string; logoHorizontalDark?: string; logoVertical?: string; logoIcon?: string; faviconData?: string;
        logoVariant?: 'text' | 'horizontal' | 'vertical' | 'icon' | 'icon-text'; logoSize?: number;
        domainPrimary?: string; domainLanding?: string; domainFormEndpoint?: string; domainApiBase?: string;
    };
    const saveRemoteBrand = useCallback(async (payload: BrandSavePayload) => {
        try {
            await saveRemoteBrandBase(payload);
            // On success, clear dirty flag & remember hash
            localBrandDirtyRef.current = false;
            try { lastSentBrandHashRef.current = JSON.stringify(payload); } catch { }
        } catch (_err) {
            // Leave dirty flag set so remote won't overwrite during user edits
        }
    }, [saveRemoteBrandBase]);
    const [brandSaveStatus, setBrandSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [brandSaveError, setBrandSaveError] = useState<string | null>(null);
    const forceSaveBrand = useCallback(() => {
        const payload: BrandSavePayload = {
            name: brandName,
            logoHorizontal: brandLogoHorizontal || undefined,
            logoHorizontalDark: brandLogoHorizontalDark || undefined,
            logoVertical: brandLogoVertical || undefined,
            logoIcon: brandLogoIcon || undefined,
            faviconData: brandFavicon || undefined,
            logoVariant: brandLogoVariant,
            logoSize: brandLogoSize,
            domainPrimary: domainPrimary || undefined,
            domainLanding: domainLanding || undefined,
            domainFormEndpoint: domainFormEndpoint || undefined,
            domainApiBase: domainApiBase || undefined,
        };
        setBrandSaveStatus('saving'); setBrandSaveError(null);
        saveRemoteBrand(payload).then(() => {
            setBrandSaveStatus('saved');
            setTimeout(() => setBrandSaveStatus(s => s === 'saved' ? 'idle' : s), 2000);
        }).catch((e: unknown) => {
            const err = (e as { message?: string }) || {};
            setBrandSaveStatus('error'); setBrandSaveError(err.message || 'Save failed');
            setTimeout(() => setBrandSaveStatus('idle'), 4000);
        });
    }, [brandName, brandLogoHorizontal, brandLogoHorizontalDark, brandLogoVertical, brandLogoIcon, brandFavicon, brandLogoVariant, brandLogoSize, domainPrimary, domainLanding, domainFormEndpoint, domainApiBase, saveRemoteBrand]);
    // Merge: prefer remote once loaded; local acts as bootstrap. If remote empty and we have local, push it once.
    const pushedRemoteRef = useRef(false);
    useLayoutEffect(() => {
        // Pre-paint hydration of brand identity to avoid flicker & mismatches
        try {
            const n = localStorage.getItem('pp_brand_name'); if (n) setBrandName(n);
            const lh = localStorage.getItem('pp_brand_logo_horizontal'); if (lh) setBrandLogoHorizontal(lh);
            const lhd = localStorage.getItem('pp_brand_logo_horizontal_dark'); if (lhd) setBrandLogoHorizontalDark(lhd);
            const lv = localStorage.getItem('pp_brand_logo_vertical'); if (lv) setBrandLogoVertical(lv);
            const li = localStorage.getItem('pp_brand_logo_icon'); if (li) setBrandLogoIcon(li);
            const lvSel = localStorage.getItem('pp_brand_logo_variant'); if (lvSel && ['horizontal', 'vertical', 'icon', 'text', 'icon-text'].includes(lvSel)) setBrandLogoVariant(lvSel as typeof brandLogoVariant);
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
        if (!hydratedBrand) return;
        // If we've already applied this remote version, skip
        interface RemoteBrand {
            updatedAt?: string; name?: string;
            logoHorizontal?: string; logoHorizontalDark?: string; logoVertical?: string; logoIcon?: string; faviconData?: string;
            logoVariant?: 'text' | 'horizontal' | 'vertical' | 'icon' | 'icon-text'; logoSize?: number;
            domainPrimary?: string; domainLanding?: string; domainFormEndpoint?: string; domainApiBase?: string;
        }
        const remote = remoteBrand as RemoteBrand;
        const remoteUpdated = remote.updatedAt;
        if (remoteUpdated && remoteUpdated === lastAppliedRemoteBrandUpdatedAt.current) return;
        // If user has unsaved local edits, don't overwrite (remote hasn't advanced)
        if (localBrandDirtyRef.current && remoteUpdated && remoteUpdated === lastAppliedRemoteBrandUpdatedAt.current) return;
        // Apply remote snapshot (single pass) then record updatedAt
        if (remote.name && remote.name !== brandName && !localBrandDirtyRef.current) setBrandName(remote.name);
        if (remote.logoHorizontal && remote.logoHorizontal !== brandLogoHorizontal && !localBrandDirtyRef.current) setBrandLogoHorizontal(remote.logoHorizontal || '');
        if (remote.logoHorizontalDark && remote.logoHorizontalDark !== brandLogoHorizontalDark && !localBrandDirtyRef.current) setBrandLogoHorizontalDark(remote.logoHorizontalDark || '');
        if (remote.logoVertical && remote.logoVertical !== brandLogoVertical && !localBrandDirtyRef.current) setBrandLogoVertical(remote.logoVertical || '');
        if (remote.logoIcon && remote.logoIcon !== brandLogoIcon && !localBrandDirtyRef.current) setBrandLogoIcon(remote.logoIcon || '');
        if (remote.faviconData && remote.faviconData !== brandFavicon && !localBrandDirtyRef.current) setBrandFavicon(remote.faviconData || '');
        if (remote.logoVariant && remote.logoVariant !== brandLogoVariant && !localBrandDirtyRef.current) setBrandLogoVariant(remote.logoVariant);
        if (typeof remote.logoSize === 'number' && remote.logoSize !== brandLogoSize && !localBrandDirtyRef.current) setBrandLogoSize(remote.logoSize);
        if (remote.domainPrimary && remote.domainPrimary !== domainPrimary && !localBrandDirtyRef.current) setDomainPrimary(remote.domainPrimary || '');
        if (remote.domainLanding && remote.domainLanding !== domainLanding && !localBrandDirtyRef.current) setDomainLanding(remote.domainLanding || '');
        if (remote.domainFormEndpoint && remote.domainFormEndpoint !== domainFormEndpoint && !localBrandDirtyRef.current) setDomainFormEndpoint(remote.domainFormEndpoint || '');
        if (remote.domainApiBase && remote.domainApiBase !== domainApiBase && !localBrandDirtyRef.current) setDomainApiBase(remote.domainApiBase || '');
        if (remoteUpdated) lastAppliedRemoteBrandUpdatedAt.current = remoteUpdated;
    }, [remoteBrand, hydratedBrand, brandName, brandLogoHorizontal, brandLogoHorizontalDark, brandLogoVertical, brandLogoIcon, brandFavicon, brandLogoVariant, brandLogoSize, domainPrimary, domainLanding, domainFormEndpoint, domainApiBase]);
    // Push local bootstrap to remote once if remote absent
    useEffect(() => {
        if (pushedRemoteRef.current) return;
        if (remoteBrand === undefined) return; // still loading
        if (remoteBrand === null) {
            saveRemoteBrand({ name: brandName }).catch(() => { });
            pushedRemoteRef.current = true;
        }
    }, [remoteBrand, brandName, saveRemoteBrand]);
    // Persistence effects consolidated; previous individual effects removed (replaced to satisfy lint)
    useEffect(() => {
        try {
            localStorage.setItem('pp_brand_name', brandName || '');
            if (brandLogoHorizontal) localStorage.setItem('pp_brand_logo_horizontal', brandLogoHorizontal); else localStorage.removeItem('pp_brand_logo_horizontal');
            if (brandLogoHorizontalDark) localStorage.setItem('pp_brand_logo_horizontal_dark', brandLogoHorizontalDark); else localStorage.removeItem('pp_brand_logo_horizontal_dark');
            if (brandLogoVertical) localStorage.setItem('pp_brand_logo_vertical', brandLogoVertical); else localStorage.removeItem('pp_brand_logo_vertical');
            if (brandLogoIcon) localStorage.setItem('pp_brand_logo_icon', brandLogoIcon); else localStorage.removeItem('pp_brand_logo_icon');
            localStorage.setItem('pp_brand_logo_variant', brandLogoVariant);
            localStorage.setItem('pp_brand_logo_size', String(brandLogoSize));
            if (brandFavicon) localStorage.setItem('pp_brand_favicon', brandFavicon); else localStorage.removeItem('pp_brand_favicon');
            if (domainPrimary) localStorage.setItem('pp_domain_primary', domainPrimary); else localStorage.removeItem('pp_domain_primary');
            if (domainLanding) localStorage.setItem('pp_domain_landing', domainLanding); else localStorage.removeItem('pp_domain_landing');
            if (domainFormEndpoint) localStorage.setItem('pp_domain_form', domainFormEndpoint); else localStorage.removeItem('pp_domain_form');
            if (domainApiBase) localStorage.setItem('pp_domain_api', domainApiBase); else localStorage.removeItem('pp_domain_api');
        } catch { /* ignore storage errors */ }
        // Remote persistence (debounced minimal) for brand identity
        const payload = {
            name: brandName,
            logoHorizontal: brandLogoHorizontal || undefined,
            logoHorizontalDark: brandLogoHorizontalDark || undefined,
            logoVertical: brandLogoVertical || undefined,
            logoIcon: brandLogoIcon || undefined,
            faviconData: brandFavicon || undefined,
            logoVariant: brandLogoVariant,
            logoSize: brandLogoSize,
            domainPrimary: domainPrimary || undefined,
            domainLanding: domainLanding || undefined,
            domainFormEndpoint: domainFormEndpoint || undefined,
            domainApiBase: domainApiBase || undefined,
        };
        let hash = '';
        try { hash = JSON.stringify(payload); } catch { }
        if (lastSentBrandHashRef.current === hash) return; // no changes since last successful send
        const id = setTimeout(() => { saveRemoteBrand(payload).catch(() => { }); }, 500);
        return () => clearTimeout(id);
    }, [brandName, brandLogoHorizontal, brandLogoHorizontalDark, brandLogoVertical, brandLogoIcon, brandLogoVariant, brandLogoSize, brandFavicon, domainPrimary, domainLanding, domainFormEndpoint, domainApiBase, saveRemoteBrand]);
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
        if (filterFirstCall) list = list.filter(c => c.firstCallStatus === filterFirstCall);
        if (filterSecondCall) list = list.filter(c => c.secondCallStatus === filterSecondCall);
        // Sorting logic
        const leadNumbersMap = computeLeadNumbers(customers); // global mapping unaffected by filter
        const progressScore = (c: Customer) => {
            let s = 0;
            if (c.firstCallStatus) s += 1;
            if (c.secondCallStatus) s += 1;
            if (c.finalStatus) s += (c.finalStatus === 'Registered' ? 2 : 1);
            return s; // higher = further along
        };
        const cmp = (a: Customer, b: Customer): number => {
            let va: string | number = 0; let vb: string | number = 0;
            switch (sortKey) {
                case 'progress':
                    va = progressScore(a); vb = progressScore(b); break;
                case 'name':
                    va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); break;
                case 'dateAdded':
                    va = a.dateAdded || ''; vb = b.dateAdded || ''; break;
                case 'leadNumber':
                    va = leadNumbersMap[a.id] || 0; vb = leadNumbersMap[b.id] || 0; break;
                default:
                    va = 0; vb = 0;
            }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        };
        list.sort(cmp);
        return list;
    }, [customers, search, filterSource, filterFinal, filterFirstCall, filterSecondCall, sortKey, sortDir]);
    // Clamp table page index if filtered results shrink below current page start
    useEffect(() => {
        if (view !== 'table') return; // only relevant in table view
        const pageSize = 25;
        const maxPageIndex = Math.max(0, Math.floor(Math.max(0, sorted.length - 1) / pageSize));
        if (tablePageIndex > maxPageIndex) setTablePageIndex(maxPageIndex);
    }, [sorted.length, tablePageIndex, view]);
    // Global (absolute) lead numbering based on full customer set, not filtered subset.
    const globalLeadNumbers = useMemo(() => computeLeadNumbers(customers), [customers]);
    const registered = useMemo(() => metrics.registered, [metrics]);

    // Theme (local) + remote sync
    const { theme, ready: themeReady, updateTheme: updateThemeLocal, setPreset: setPresetLocal, presets, customStatusColors, updateStatusColor, exportTheme, importTheme, toggleMode } = useTheme();
    const { themeSettings, setTheme: saveThemeRemote } = useThemeSettings(instanceId);
    const themePushedRef = useRef(false);
    const lastLocalThemeChangeRef = useRef<string | null>(null);

    // Wrap local update to also persist remotely and mark timestamp so we don't immediately overwrite from stale remote copy.
    const updateTheme = useCallback((partial: Partial<BrandTheme>) => {
        const stamp = new Date().toISOString();
        lastLocalThemeChangeRef.current = stamp;
        // compute next theme snapshot (since state won't reflect until next render)
        const next: BrandTheme = { ...theme, ...partial };
        updateThemeLocal(partial);
        // push full theme to remote (fire and forget)
        saveThemeRemote({
            from: next.from, via: next.via, to: next.to, background: next.background, cardBg: next.cardBg, mutedBg: next.mutedBg, border: next.border,
            primaryText: next.primaryText, secondaryText: next.secondaryText, sidebarText: next.sidebarText, headerText: next.headerText, mode: next.mode,
            backgroundRadialCenter: next.backgroundRadialCenter, backgroundRadialEdge: next.backgroundRadialEdge
        }).catch(() => { });
    }, [theme, updateThemeLocal, saveThemeRemote]);

    // Status color remote sync (defer helper definitions until just before render for clarity later)
    const { statusColors: remoteStatusColors, setStatusColor: saveStatusColorRemote } = useStatusColors(instanceId);
    const statusPushedRef = useRef(false);

    const setPreset = useCallback((key: string) => {
        const preset = (presets as Record<string, BrandTheme>)[key];
        if (!preset) return;
        const stamp = new Date().toISOString();
        lastLocalThemeChangeRef.current = stamp;
        setPresetLocal(key);
        saveThemeRemote({
            from: preset.from, via: preset.via, to: preset.to, background: preset.background, cardBg: preset.cardBg, mutedBg: preset.mutedBg, border: preset.border,
            primaryText: preset.primaryText, secondaryText: preset.secondaryText, sidebarText: preset.sidebarText, headerText: preset.headerText, mode: preset.mode,
            backgroundRadialCenter: preset.backgroundRadialCenter, backgroundRadialEdge: preset.backgroundRadialEdge
        }).catch(() => { });
        // We'll regenerate status colors after helper definitions (flag via ref)
        statusPaletteNeedsRegenerationRef.current = true;
    }, [presets, setPresetLocal, saveThemeRemote]);
    // Apply remote theme once received (after local hydration) or push local if remote empty
    useEffect(() => {
        if (!themeReady) return;
        if (themeSettings === undefined) return; // loading
        if (themeSettings === null && !themePushedRef.current) {
            // push current theme to remote
            saveThemeRemote({
                from: theme.from, via: theme.via, to: theme.to, background: theme.background, cardBg: theme.cardBg, mutedBg: theme.mutedBg, border: theme.border,
                primaryText: theme.primaryText, secondaryText: theme.secondaryText, sidebarText: theme.sidebarText, headerText: theme.headerText, mode: theme.mode,
                backgroundRadialCenter: theme.backgroundRadialCenter, backgroundRadialEdge: theme.backgroundRadialEdge
            }).catch(() => { });
            themePushedRef.current = true;
            return;
        }
        if (themeSettings) {
            // If we have a recent unsynced local change (timestamp newer than remote), skip applying remote snapshot
            if (lastLocalThemeChangeRef.current && themeSettings.updatedAt && themeSettings.updatedAt < lastLocalThemeChangeRef.current) {
                return; // local newer; remote update pending or in-flight
            }
            // if remote differs (and not newer local), update local theme (without marking as local change)
            const themeKeys: (keyof BrandTheme)[] = ['from', 'via', 'to', 'background', 'cardBg', 'mutedBg', 'border', 'primaryText', 'secondaryText', 'sidebarText', 'headerText', 'mode', 'backgroundRadialCenter', 'backgroundRadialEdge'];
            const diff = themeKeys.some(k => theme[k] !== (themeSettings as unknown as Record<string, string>)[k]);
            if (diff) {
                updateThemeLocal({
                    from: themeSettings.from, via: themeSettings.via, to: themeSettings.to, background: themeSettings.background, cardBg: themeSettings.cardBg,
                    mutedBg: themeSettings.mutedBg, border: themeSettings.border, primaryText: themeSettings.primaryText, secondaryText: themeSettings.secondaryText,
                    sidebarText: themeSettings.sidebarText, headerText: themeSettings.headerText, mode: (themeSettings.mode === 'dark' ? 'dark' : themeSettings.mode === 'light' ? 'light' : undefined),
                    backgroundRadialCenter: themeSettings.backgroundRadialCenter, backgroundRadialEdge: themeSettings.backgroundRadialEdge
                });
            }
        }
    }, [themeReady, themeSettings, theme, updateThemeLocal, saveThemeRemote]);
    // Prepare status palette helpers (defined once theme & hooks available)
    const statusPaletteNeedsRegenerationRef = useRef(false);
    const generateStatusPalette = useCallback(() => {
        const baseStatuses = ['Interested', 'Answered', 'Voicemail', 'They Called', 'We Called', 'Registered', 'Follow-up Needed', 'Not Registered'] as const;
        const stops = [theme.from, theme.via, theme.to] as const;
        const shift = (hex: string, factor: number) => {
            if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const scale = (c: number) => Math.max(0, Math.min(255, Math.round(c * factor)));
            return '#' + [scale(r), scale(g), scale(b)].map(v => v.toString(16).padStart(2, '0')).join('');
        };
        const palette = [
            shift(stops[0], 1.15), shift(stops[0], 0.95), shift(stops[1], 1.05), shift(stops[1], 0.85),
            shift(stops[2], 1.10), shift(stops[2], 0.90), shift(stops[1], 0.70), shift(stops[2], 0.60)
        ] as const;
        return Object.fromEntries(baseStatuses.map((s, i) => [s, palette[i]])) as Record<typeof baseStatuses[number], string>;
    }, [theme.from, theme.via, theme.to]);
    const updateStatusColorRemoteAware = useCallback((key: string, value: string) => {
        updateStatusColor(key, value);
        saveStatusColorRemote({ key, color: value }).catch(() => { });
    }, [updateStatusColor, saveStatusColorRemote]);
    const regenerateStatusPalette = useCallback(() => {
        const map = generateStatusPalette();
        Object.entries(map).forEach(([k, v]) => updateStatusColorRemoteAware(k, v as string));
    }, [generateStatusPalette, updateStatusColorRemoteAware]);
    // (Legacy refs removed; using direct functions in JSX now)
    // Initial hydrate or seed
    useEffect(() => {
        if (remoteStatusColors === undefined) return;
        if (remoteStatusColors && remoteStatusColors.length && !statusPushedRef.current) {
            remoteStatusColors.forEach(r => { if (customStatusColors[r.key] !== r.color) updateStatusColor(r.key, r.color); });
            statusPushedRef.current = true;
        } else if (remoteStatusColors === null && !statusPushedRef.current) {
            const map = generateStatusPalette();
            Object.entries(map).forEach(([k, v]) => saveStatusColorRemote({ key: k, color: v as string }));
            statusPushedRef.current = true;
        }
    }, [remoteStatusColors, customStatusColors, updateStatusColor, saveStatusColorRemote, generateStatusPalette]);
    // After preset selection flag, regenerate once remote is ready
    useEffect(() => {
        if (statusPaletteNeedsRegenerationRef.current) {
            regenerateStatusPalette();
            statusPaletteNeedsRegenerationRef.current = false;
        }
    }, [regenerateStatusPalette]);
    // Determine dark mode from explicit mode flag (fallback to legacy preset key for backward compatibility)
    const darkMode = theme.mode === 'dark' || (!theme.mode && theme.key === 'black');
    const leadControlViewsList = ['table', 'grouped', 'registered', 'kanban'] as const;
    const leadControlViews = new Set(leadControlViewsList);
    const showLeadControls = leadControlViews.has(view as typeof leadControlViewsList[number]);
    const jumpToViewsList = ['table', 'grouped', 'registered'] as const; // All Leads, Daily Leads, Customers
    const showJumpTo = new Set(jumpToViewsList).has(view as typeof jumpToViewsList[number]);
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
    const radialCenter = (theme.backgroundRadialCenter || tv.background);
    const radialEdge = (theme.backgroundRadialEdge || 'transparent');
    return (
        <main suppressHydrationWarning className={`min-h-screen font-sans flex ${darkMode ? 'text-white bg-[#0F1115]' : ''}`}
            style={{
                ['--brand-from' as string]: tv.from,
                ['--brand-via' as string]: tv.via,
                ['--brand-to' as string]: tv.to,
                ['--brand-text' as string]: tv.text,
                ['--brand-bg' as string]: tv.background,
                ['--brand-radial-center' as string]: radialCenter,
                ['--brand-radial-edge' as string]: radialEdge,
                background: darkMode ? undefined : `radial-gradient(circle at 30% 20%, ${radialCenter}, ${radialEdge} 60%), linear-gradient(to bottom right, #ffffff, ${tv.background}, ${tv.background})`,
                ['--brand-sidebar-text' as string]: tv.sidebarText,
                ['--brand-header-text' as string]: tv.headerText
            } as React.CSSProperties}>
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
                <header className={`sticky top-0 z-40 border-b shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] transition-colors ${theme.mode === 'dark' ? 'bg-[#0F172A]/95 backdrop-blur border-slate-700/50' : 'bg-white border-black/5'}`} style={{ color: 'var(--brand-header-text)' }}>
                    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
                        <div style={{ visibility: hydratedBrand ? 'visible' : 'hidden' }} suppressHydrationWarning>
                            {(() => {
                                const map: Record<string, string> = { horizontal: (theme.mode === 'dark' && brandLogoHorizontalDark) ? brandLogoHorizontalDark : brandLogoHorizontal, vertical: brandLogoVertical, icon: brandLogoIcon };
                                const selected = brandLogoVariant === 'text' || brandLogoVariant === 'icon-text' ? '' : map[brandLogoVariant];
                                const iconForCombo = brandLogoVariant === 'icon-text' ? map.icon : '';
                                const showText = brandLogoVariant === 'icon-text' ? true : !selected;
                                const base = (brandLogoVariant === 'icon' || brandLogoVariant === 'icon-text') ? 36 : 40;
                                const h = Math.round(base * brandLogoSize);
                                return (
                                    <h1 className="flex items-center gap-3 text-xl md:text-2xl font-black tracking-tight select-none">
                                        {iconForCombo && <img src={iconForCombo} alt="Icon" style={{ height: h, width: h }} className="object-contain" />}
                                        {selected && !iconForCombo && <img src={selected} alt="Logo" style={{ height: h, width: brandLogoVariant === 'icon' ? h : 'auto', maxHeight: 160, maxWidth: 320 }} className={`object-contain ${brandLogoVariant === 'icon' ? '' : 'max-w-[260px]'} ${theme.mode === 'dark' ? 'drop-shadow-[0_0_6px_rgba(0,0,0,0.4)]' : ''}`} />}
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
                                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads or customers" className={`w-full h-10 pl-8 pr-3 rounded-xl backdrop-blur text-[12px] font-medium placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)] ring-1 transition-colors ${theme.mode === 'dark' ? 'bg-slate-800/70 hover:bg-slate-800/80 ring-slate-600/60' : 'bg-white/60 hover:bg-white/80 ring-white/60'}`} />
                                    </div>
                                    <div className="relative">
                                        <button onClick={() => setAnchorFilter(o => !o)} className={`h-10 px-3 rounded-xl flex items-center gap-2 text-[11px] font-semibold ring-1 backdrop-blur transition-colors ${anchorFilter ? 'bg-[var(--brand-from)]/25 ring-transparent text-white' : (theme.mode === 'dark' ? 'bg-slate-800/70 hover:bg-slate-800/80 ring-slate-600/60' : 'bg-white/60 hover:bg-white/80 ring-white/60')}`}><Filter size={14} />Filter</button>
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
                                                <div className="space-y-2">
                                                    <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#2e1b40' }}>1st Call Status</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <FilterChip label="All" active={!filterFirstCall} onClick={() => setFilterFirstCall('')} />
                                                        {FIRST_CALL_STATUS_OPTIONS.map(s => <FilterChip key={s} label={s} active={filterFirstCall === s} onClick={() => setFilterFirstCall(s)} />)}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#2e1b40' }}>2nd Call Status</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <FilterChip label="All" active={!filterSecondCall} onClick={() => setFilterSecondCall('')} />
                                                        {SECOND_CALL_STATUS_OPTIONS.map(s => <FilterChip key={s} label={s} active={filterSecondCall === s} onClick={() => setFilterSecondCall(s)} />)}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-2">
                                                    <button onClick={() => { setFilterSource(''); setFilterFinal(''); setFilterFirstCall(''); setFilterSecondCall(''); }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60">Reset</button>
                                                    <button onClick={() => setAnchorFilter(false)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white shadow">Done</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <button onClick={() => { setSelectionMode(m => !m); if (selectionMode) clearSelection(); }} className={`h-10 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-2 bg-white/60 hover:bg-white ring-1 ring-white/70 ${selectionMode ? '!bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white ring-0' : ''}`}>{selectionMode ? <CheckSquare size={14} /> : <Square size={14} />} {selectionMode ? `${selectedIds.size} Selected` : 'Select'}</button>
                                        {selectionMode && selectedIds.size > 0 && (
                                            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white/90 backdrop-blur-xl ring-1 ring-black/5 shadow-xl p-4 z-50 text-[12px] font-medium flex flex-col gap-4" style={{ color: '#1a1026' }}>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#1a1026' }}>Bulk Actions</span>
                                                    <button onClick={clearSelection} className="text-[11px] font-semibold" style={{ color: '#2e1b40' }} >Clear</button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <BulkBtn label="Mark Interested" onClick={() => { bulkUpdate(Array.from(selectedIds), { firstCallStatus: 'Interested' }); }} />
                                                    <BulkBtn label="Mark Answered" onClick={() => { bulkUpdate(Array.from(selectedIds), { firstCallStatus: 'Answered' }); }} />
                                                    <BulkBtn label="Final Registered" onClick={() => { bulkUpdate(Array.from(selectedIds), { finalStatus: 'Registered' }); }} />
                                                    <BulkBtn label="Final Not Reg" onClick={() => { bulkUpdate(Array.from(selectedIds), { finalStatus: 'Not Registered' }); }} />
                                                    <BulkBtn label="Final Follow-up" onClick={() => { bulkUpdate(Array.from(selectedIds), { finalStatus: 'Follow-up Needed' }); }} />
                                                    <BulkBtn label="Clear Final" onClick={() => { bulkUpdate(Array.from(selectedIds), { finalStatus: '' }); }} />
                                                </div>
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => setSelectionMode(false)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60">Close</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => setShowTools(s => !s)} className="h-10 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-2 bg-white/60 hover:bg-white ring-1 ring-white/70" style={{ color: '#1a1026' }}>
                                        <SlidersHorizontal size={14} /> Tools
                                    </button>
                                </>
                            )}
                            <ProfileMenu />
                        </div>
                    </div>
                </header>
                {/* Tools Sidebar Overlay with animated slide-in */}
                {(showTools || toolsActive) && (
                    <div className={`fixed inset-0 z-50 flex overflow-hidden transition-colors duration-300 ${showTools ? 'bg-black/20' : 'bg-black/0 pointer-events-none'}`} aria-label="Tools Sidebar" role="dialog" aria-modal="true">
                        <div className="flex-1" onClick={() => setShowTools(false)} />
                        <div className={`w-[300px] md:w-[340px] h-full flex flex-col gap-6 p-5 shadow-xl border-l border-black/10 dark:border-slate-600 bg-white dark:bg-slate-900/90 backdrop-blur-xl transform transition-transform duration-300 ease-out ${showTools ? 'translate-x-0' : 'translate-x-full'}`}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#1a1026] dark:text-slate-100">Tools</h3>
                                <button onClick={() => setShowTools(false)} className="p-2 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)]" aria-label="Close tools sidebar"><X size={16} /></button>
                            </div>
                            <div className="space-y-3">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#2e1b40] dark:text-slate-300">History</div>
                                <div className="flex items-center gap-3">
                                    <button ref={undoBtnRef} disabled={!canUndo} onClick={undo} className={`flex-1 h-10 px-3 rounded-xl text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)] transition ${canUndo ? 'bg-[var(--brand-from)] text-white shadow hover:brightness-110' : 'opacity-40 cursor-not-allowed bg-black/5 dark:bg-slate-700/40 text-[#2e1b40] dark:text-slate-400'}`}>Undo</button>
                                    <button disabled={!canRedo} onClick={redo} className={`flex-1 h-10 px-3 rounded-xl text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)] transition ${canRedo ? 'bg-[var(--brand-from)] text-white shadow hover:brightness-110' : 'opacity-40 cursor-not-allowed bg-black/5 dark:bg-slate-700/40 text-[#2e1b40] dark:text-slate-400'}`}>Redo</button>
                                </div>
                            </div>
                            {showJumpTo && (
                                <div className="space-y-2">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-[#2e1b40] dark:text-slate-300">Jump To Date</div>
                                    <input type="date" value={jumpDate} onChange={e => setJumpDate(e.target.value)}
                                        min={(() => { try { const all = document.querySelectorAll('[data-day]'); if (all.length) { return (all[0] as HTMLElement).getAttribute('data-day') || ''; } } catch { } return ''; })()}
                                        max={(() => { try { const all = document.querySelectorAll('[data-day]'); if (all.length) { return (all[all.length - 1] as HTMLElement).getAttribute('data-day') || ''; } } catch { } return ''; })()}
                                        className="h-10 w-full rounded-xl bg-white/80 dark:bg-slate-800/70 ring-1 ring-black/10 dark:ring-slate-700 px-3 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)] text-[#1a1026] dark:text-slate-100 placeholder:opacity-60" />
                                </div>
                            )}
                            <div className="space-y-3">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#2e1b40] dark:text-slate-300">Sorting</div>
                                <div className="flex gap-2">
                                    <select value={sortKey} onChange={e => setSortKey(e.target.value as typeof sortKey)} className="flex-1 h-10 px-2 rounded-xl bg-white/80 dark:bg-slate-800/70 ring-1 ring-black/10 dark:ring-slate-700 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)] text-[#1a1026] dark:text-slate-100">
                                        <option value="dateAdded">Date Added</option>
                                        <option value="progress">Progress</option>
                                        <option value="name">Name</option>
                                        <option value="leadNumber">Lead #</option>
                                    </select>
                                    <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="h-10 px-3 rounded-xl text-[11px] font-semibold bg-white/90 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 ring-1 ring-black/10 dark:ring-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)] text-[#1a1026] dark:text-slate-100">{sortDir === 'asc' ? 'Asc' : 'Desc'}</button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#2e1b40] dark:text-slate-300">Export</div>
                                <button onClick={() => {
                                    const base = (selectionMode && selectedIds.size > 0) ? sorted.filter(c => selectedIds.has(c.id)) : sorted;
                                    const unique: Record<string, boolean> = {};
                                    const lines: string[] = [];
                                    base.forEach(c => {
                                        const phone = (c.phone || '').trim();
                                        if (!phone) return;
                                        const key = phone + '|' + (c.name || '');
                                        if (unique[key]) return; unique[key] = true;
                                        const safeName = (c.name || phone).replace(/\r|\n/g, ' ').trim();
                                        lines.push('BEGIN:VCARD');
                                        lines.push('VERSION:3.0');
                                        lines.push('FN:' + safeName);
                                        lines.push('N:' + safeName + ';;;;');
                                        lines.push('TEL;TYPE=CELL:' + phone.replace(/[^+0-9]/g, ''));
                                        if (c.firstCallStatus) lines.push('X-FIRST-CALL-STATUS:' + c.firstCallStatus);
                                        if (c.secondCallStatus) lines.push('X-SECOND-CALL-STATUS:' + c.secondCallStatus);
                                        if (c.finalStatus) lines.push('X-FINAL-STATUS:' + c.finalStatus);
                                        lines.push('END:VCARD');
                                    });
                                    if (!lines.length) { alert('No contacts with phone numbers to export.'); return; }
                                    const blob = new Blob([lines.join('\n')], { type: 'text/vcard;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url; const ts = new Date().toISOString().slice(0, 10);
                                    a.download = `contacts_${selectionMode && selectedIds.size ? 'selected' : 'filtered'}_${ts}.vcf`;
                                    a.click();
                                    setTimeout(() => URL.revokeObjectURL(url), 1500);
                                }} disabled={sorted.length === 0} className="w-full h-10 px-3 rounded-xl text-[11px] font-semibold bg-[var(--brand-from)] text-white shadow hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)] disabled:opacity-40 disabled:cursor-not-allowed">Export Contacts</button>
                            </div>
                            <div className="mt-auto text-[10px] font-medium opacity-70 text-[#2e1b40] dark:text-slate-400">Press Esc or click backdrop to close. Settings persist.</div>
                        </div>
                    </div>
                )}
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
                            if (view === 'table') return <CustomerTable pageIndex={tablePageIndex} onPageIndexChange={setTablePageIndex} leadNumbers={globalLeadNumbers} mode="compact" onOpenCustomer={(id) => setOpenCustomerId(id)} data={base} onUpdateCustomer={updateCustomer} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} onVisibleIdsChange={() => { }} />;
                            if (view === 'cards') return <CustomerCards leadNumbers={globalLeadNumbers} data={base} onUpdateCustomer={updateCustomer} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />;
                            if (view === 'grouped') return <CustomerCardsGrouped leadNumbers={globalLeadNumbers} data={base} onUpdateCustomer={updateCustomer} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />;
                            if (view === 'registered') return <CustomerCards leadNumbers={globalLeadNumbers} data={base} onUpdateCustomer={updateCustomer} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />;
                            if (view === 'kanban') return <KanbanPipeline leadNumbers={globalLeadNumbers} data={base} onUpdateCustomer={updateCustomer} selectedIds={selectedIds} onToggleSelect={toggleSelect} onOpen={(id) => setOpenCustomerId(id)} />;
                            if (view === 'analytics') return (
                                <div className="space-y-4">
                                    {(remoteCount !== undefined && remoteCount !== customers.length) && (
                                        <div className="text-[11px] font-medium px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                                            Cloud shows <strong>{remoteCount}</strong> records; local session has <strong>{customers.length}</strong>. Displaying merged view (max). Force Sync ensures local-only rows push up.
                                        </div>
                                    )}
                                    {uniquePhoneCount !== customers.length && (
                                        <div className="text-[11px] font-medium px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
                                            {customers.length - uniquePhoneCount} duplicate phone entr{customers.length - uniquePhoneCount === 1 ? 'y' : 'ies'} detected (after merges). Totals count individual rows; analytics may later switch to unique leads.
                                        </div>
                                    )}
                                    <AnalyticsOverview data={customers} remoteCount={remoteCount} localCount={customers.length} uniquePhoneCount={uniquePhoneCount} />
                                </div>
                            );
                            if (view === 'settings') return <SettingsPanel instanceId={instanceId} theme={theme} presets={presets} setPreset={setPreset} updateTheme={updateTheme} customStatusColors={customStatusColors} updateStatusColor={updateStatusColorRemoteAware} regenerateStatusColors={regenerateStatusPalette} exportTheme={exportTheme} importTheme={importTheme} forceSync={forceSync} customersForExport={customers} toggleMode={toggleMode}
                                brandName={brandName} setBrandName={setBrandName}
                                brandLogoHorizontal={brandLogoHorizontal} setBrandLogoHorizontal={setBrandLogoHorizontal}
                                brandLogoHorizontalDark={brandLogoHorizontalDark} setBrandLogoHorizontalDark={setBrandLogoHorizontalDark}
                                brandLogoVertical={brandLogoVertical} setBrandLogoVertical={setBrandLogoVertical}
                                brandLogoIcon={brandLogoIcon} setBrandLogoIcon={setBrandLogoIcon}
                                brandLogoVariant={brandLogoVariant} setBrandLogoVariant={setBrandLogoVariant}
                                brandLogoSize={brandLogoSize} setBrandLogoSize={setBrandLogoSize}
                                brandFavicon={brandFavicon} setBrandFavicon={setBrandFavicon}
                                domainPrimary={domainPrimary} setDomainPrimary={setDomainPrimary}
                                domainLanding={domainLanding} setDomainLanding={setDomainLanding}
                                domainFormEndpoint={domainFormEndpoint} setDomainFormEndpoint={setDomainFormEndpoint}
                                domainApiBase={domainApiBase} setDomainApiBase={setDomainApiBase}
                                markBrandDirty={markBrandDirty} forceSaveBrand={forceSaveBrand} brandSaveStatus={brandSaveStatus} brandSaveError={brandSaveError} isBrandDirty={localBrandDirtyRef.current}
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
interface MetricsShape { total: number; registered: number }
function DashboardPanel({ customers, metrics }: { customers: Customer[]; metrics: MetricsShape }) {
    // Remote goals & affirmation (Convex) migration
    const { goals: remoteGoals, setGoals } = useGoals();
    const defaultAffirmation = "I AM SO HAPPY AND GRATEFUL NOW THAT PALI PROS HAS 10,000 ACTIVE MEMBERS GOING STRONG AND ONLY INCREASING."; // quotes escaped OK
    // Local working state (mirrors remote; no localStorage persistence anymore)
    const [goalChiefAim, setGoalChiefAim] = useState<number>(0);
    const [goalSweetSpot, setGoalSweetSpot] = useState<number>(0);
    const [goalWin, setGoalWin] = useState<number>(0);
    const [goalPresets, setGoalPresets] = useState<{ id?: string; name: string; value: number }[]>([]);
    const [affirmation, setAffirmation] = useState<string>(defaultAffirmation);
    const migratedRef = useRef(false);
    const hydratedRef = useRef(false);
    // When remote goals load, hydrate local OR bootstrap from legacy localStorage once if remote empty
    useEffect(() => {
        if (remoteGoals === undefined) return; // still loading
        if (hydratedRef.current) return; // already hydrated
        if (remoteGoals) {
            setGoalChiefAim(remoteGoals.chiefAim || 0);
            setGoalSweetSpot(remoteGoals.sweetSpot || 0);
            setGoalWin(remoteGoals.win || 0);
            setGoalPresets((remoteGoals.presets || []).map(p => ({ ...p })));
            setAffirmation(remoteGoals.affirmation || defaultAffirmation);
            hydratedRef.current = true;
            return;
        }
        // Remote null: attempt one‑time legacy bootstrap from localStorage (migration) then push
        if (!migratedRef.current) {
            let chief = 0, sweet = 0, win = 0; let presets: { id?: string; name: string; value: number }[] = []; let aff = defaultAffirmation;
            try {
                const legacyChief = localStorage.getItem('pp_goal_chief') || localStorage.getItem('pp_goal_registered');
                const legacySweet = localStorage.getItem('pp_goal_sweet');
                const legacyWin = localStorage.getItem('pp_goal_win');
                if (legacyChief) chief = Number(legacyChief) || 0;
                if (legacySweet) sweet = Number(legacySweet) || 0;
                if (legacyWin) win = Number(legacyWin) || 0;
                const rawPresets = localStorage.getItem('pp_goal_presets');
                if (rawPresets) {
                    try {
                        const arr = JSON.parse(rawPresets);
                        if (Array.isArray(arr)) {
                            type LegacyPreset = { id?: string; name?: unknown; value?: unknown };
                            presets = (arr as LegacyPreset[])
                                .filter(p => p && typeof p.name === 'string' && typeof p.value === 'number')
                                .map(p => ({ id: p.id, name: p.name as string, value: p.value as number }));
                        }
                    } catch { }
                }
                const legacyAff = localStorage.getItem('pp_goal_chief_affirmation');
                if (legacyAff && legacyAff.trim()) aff = legacyAff;
            } catch { }
            setGoalChiefAim(chief); setGoalSweetSpot(sweet); setGoalWin(win); setGoalPresets(presets); setAffirmation(aff || defaultAffirmation);
            setGoals({ chiefAim: chief, sweetSpot: sweet, win, affirmation: aff || defaultAffirmation, presets: presets.map(p => ({ id: p.id || p.name, name: p.name, value: p.value })) }).catch(() => { });
            migratedRef.current = true; hydratedRef.current = true;
        }
    }, [remoteGoals, setGoals, defaultAffirmation]);
    // Debounced remote persistence of edits (skip until hydrated)
    const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!hydratedRef.current) return; // don't save until we've hydrated
        if (remoteGoals === undefined) return; // loading
        if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = setTimeout(() => {
            setGoals({
                chiefAim: goalChiefAim,
                sweetSpot: goalSweetSpot,
                win: goalWin,
                affirmation,
                presets: goalPresets.map(p => ({ id: p.id || p.name, name: p.name, value: p.value }))
            }).catch(() => { /* silent for now */ });
        }, 600);
        return () => { if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current); };
    }, [goalChiefAim, goalSweetSpot, goalWin, affirmation, goalPresets, setGoals, remoteGoals]);
    // Simple preset add helper (future UI could hook in)
    // removed unused addPreset helper
    const registered = metrics.registered ?? customers.filter(c => c.finalStatus === 'Registered').length;
    const progressChief = goalChiefAim > 0 ? Math.min(1, registered / goalChiefAim) : 0;
    const progressSweet = goalSweetSpot > 0 ? Math.min(1, registered / goalSweetSpot) : 0;
    const progressWin = goalWin > 0 ? Math.min(1, registered / goalWin) : 0;
    // Anchor 'now' post-mount to prevent SSR/client date divergence (hydration mismatch)
    const [now, setNow] = useState<Date | null>(null);
    useEffect(() => { setNow(new Date()); }, []);
    // Stable today reference (memoized) so exhaustive-deps does not complain
    // removed todayRef (was previously used to stabilize date calculations)
    const isISO = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const recent7 = useMemo(() => {
        if (!now) return [] as { date: string; count: number }[]; // defer until hydrated
        const today = now; // use now directly; todayRef adds no value
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
        const today = now;
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
    // const targetDate = projectedDays ? new Date(Date.now() + projectedDays * 86400000).toISOString().slice(0, 10) : null; // (unused)
    // Milestones for chief aim
    const milestonesChief = useMemo(() => goalChiefAim > 0 ? [0.25, 0.5, 0.75, 1].map(r => ({ ratio: r, value: Math.round(goalChiefAim * r), reached: registered >= goalChiefAim * r })) : [], [goalChiefAim, registered]);
    // Cohort retention (weekly)
    const cohortData = useMemo(() => {
        if (!now) return [] as { weekStart: string; total: number; registered: number; rate: number }[];
        const map: Record<string, { total: number; registered: number }> = {};
        customers.forEach(c => {
            if (!isISO(c.dateAdded)) return; const d = new Date(c.dateAdded + 'T00:00:00'); if (isNaN(d.getTime())) return; const day = d.getDay();
            const diff = (day + 6) % 7; // Monday-based
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
        const today = now;
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
        const todayKey = now.toISOString().slice(0, 10);
        const isValid = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
        const newLeadsToday = customers.filter(c => c.dateAdded === todayKey).length;
        const firstCallsToday = customers.filter(c => c.firstCallDate === todayKey && c.firstCallStatus).length;
        const secondCallsToday = customers.filter(c => c.secondCallDate === todayKey && c.secondCallStatus).length;
        const finalCallsToday = customers.filter(c => c.finalCallDate === todayKey && c.finalStatus).length;
        const totalCallTouchesToday = firstCallsToday + secondCallsToday + finalCallsToday;
        // Leads needing first contact ONLY (requested): no first call date/status AND not in a terminal final status
        const toCallToday = customers.filter(c => {
            if (c.finalStatus === 'Registered' || c.finalStatus === 'Not Registered') return false;
            return !isValid(c.firstCallDate) && !c.firstCallStatus;
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
                                {goalChiefAim > 0 && projectedDays > 0 && <p className="text-[10px]" style={{ color: 'var(--brand-text-secondary)' }}>At your 14-day pace you may hit chief aim in <strong>{projectedDays}d</strong>.</p>}
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
                    <p className="text-[10px] font-medium" style={{ color: 'var(--brand-text-secondary)' }}>&quot;To Call Today&quot; = leads with no recorded first call (date or status) and not in a final status.</p>
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
                    {/* End charts section */}
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
    const winStops: { offset: string; color: string }[] = [
        { offset: '0%', color: '#0d9488' },
        { offset: '55%', color: '#14b8a6' },
        { offset: '100%', color: '#10b981' },
    ];
    const sweetStops: { offset: string; color: string }[] = [
        { offset: '0%', color: '#f59e0b' },
        { offset: '50%', color: '#f97316' },
        { offset: '100%', color: '#ec4899' },
    ];
    const chiefStops: { offset: string; color: string }[] = [
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

interface SettingsPanelProps {
    theme: BrandTheme;
    presets: Record<string, BrandTheme>;
    setPreset: (k: string) => void;
    updateTheme: (p: Partial<BrandTheme>) => void;
    customStatusColors: Record<string, string>;
    updateStatusColor: (k: string, v: string) => void;
    regenerateStatusColors: () => void;
    exportTheme: () => void;
    importTheme: (f: File) => void;
    forceSync: () => Promise<{ added: number; skipped: number }>;
    toggleMode: () => void;
    brandName: string; setBrandName: (v: string) => void;
    brandLogoHorizontal: string; setBrandLogoHorizontal: (v: string) => void; brandLogoHorizontalDark: string; setBrandLogoHorizontalDark: (v: string) => void;
    brandLogoVertical: string; setBrandLogoVertical: (v: string) => void;
    brandLogoIcon: string; setBrandLogoIcon: (v: string) => void;
    brandLogoVariant: 'horizontal' | 'vertical' | 'icon' | 'icon-text' | 'text'; setBrandLogoVariant: (v: 'horizontal' | 'vertical' | 'icon' | 'icon-text' | 'text') => void;
    brandLogoSize: number; setBrandLogoSize: (v: number | ((prev: number) => number)) => void;
    brandFavicon: string; setBrandFavicon: (v: string) => void;
    domainPrimary: string; setDomainPrimary: (v: string) => void;
    domainLanding: string; setDomainLanding: (v: string) => void;
    domainFormEndpoint: string; setDomainFormEndpoint: (v: string) => void;
    domainApiBase: string; setDomainApiBase: (v: string) => void;
    customersForExport: Customer[];
    instanceId: string;
    // brand explicit save workflow props
    markBrandDirty: () => void;
    forceSaveBrand: () => void;
    brandSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
    brandSaveError: string | null;
    isBrandDirty: boolean;
}
function SettingsPanel({ theme, presets: _presets, setPreset: _setPreset, updateTheme, customStatusColors: _customStatusColors, updateStatusColor: _updateStatusColor, regenerateStatusColors: _regenerateStatusColors, exportTheme, importTheme: _importTheme, forceSync, toggleMode: _toggleMode, brandName, setBrandName,
    brandLogoHorizontal, setBrandLogoHorizontal, brandLogoHorizontalDark, setBrandLogoHorizontalDark,
    brandLogoVertical, setBrandLogoVertical,
    brandLogoIcon, setBrandLogoIcon,
    brandLogoVariant, setBrandLogoVariant,
    brandLogoSize, setBrandLogoSize,
    brandFavicon, setBrandFavicon,
    domainPrimary, setDomainPrimary,
    domainLanding, setDomainLanding,
    domainFormEndpoint, setDomainFormEndpoint,
    domainApiBase, setDomainApiBase,
    // Added customers for export
    customersForExport, instanceId,
    // brand explicit save workflow props
    markBrandDirty, forceSaveBrand, brandSaveStatus, brandSaveError, isBrandDirty }: SettingsPanelProps) {
    // Convex mutations for importing leads
    const bulkUpsert = useMutation(api.customers.bulkUpsert);
    const dedupePhonesMutation = useMutation(api.customers.dedupePhones as unknown as typeof api.customers.dedupePhones);
    const [importSource, setImportSource] = useState<string>('');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<null | { rows: number; merged: number; removed: number; created: number; updated: number }>(null);
    const [treatDuplicateLeadIdsAsUpdates, setTreatDuplicateLeadIdsAsUpdates] = useState(true);
    // Local force sync status (parent only supplies the function)
    const [forceSyncStatus, setForceSyncStatus] = useState<{ running: boolean; msg: string | null }>({ running: false, msg: null });
    const sections: { key: string; label: string; description?: string }[] = [
        { key: 'identity', label: 'Brand Identity', description: 'Name, logo & favicon' },
        { key: 'domains', label: 'Domains', description: 'Primary & landing URLs' },
        { key: 'brand', label: 'Brand Colors', description: 'Customize gradients and surfaces' },
        { key: 'import', label: 'Import CSV', description: 'Upload leads data' },
        { key: 'export', label: 'Export / Backup', description: 'Download theme & data (coming)' },
        { key: 'appearance', label: 'Appearance', description: 'Light vs Dark & density' },
        { key: 'notifications', label: 'Notifications', description: 'Email / in‑app alerts (coming)' },
        { key: 'goals', label: 'Goals & Affirmation', description: 'Manage goal presets (coming)' },
        { key: 'advanced', label: 'Advanced', description: 'Raw JSON theme & developer tools (coming)' },
    ];
    const [active, setActive] = useState<string>('identity');
    // Base accent pulls from theme, but override to deep violet for Brand section per request
    let accentColor = theme.secondaryText || '#5b21b6';
    // In dark mode use a deep slate (dark text on light/translucent panels) for better contrast
    if (theme.mode === 'dark') {
        // Light slate for high contrast on darker panels
        accentColor = '#CBD5E1'; // slate-300
    }
    // Section-specific override (brighter heading text in dark mode)
    if (active === 'brand' || active === 'identity') {
        accentColor = theme.mode === 'dark' ? '#F1F5F9' : '#1a1026';
    }

    // Dynamic text color helper (for inside panels) chooses light or dark based on bg hex
    const getReadable = (bg: string, light = '#F8FAFC', dark = '#0F172A') => {
        const hex = /^#([0-9a-fA-F]{8}|[0-9a-fA-F]{6})$/.test(bg) ? bg.slice(0, 7) : '#1A2330';
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const toLin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
        return L < 0.45 ? light : dark;
    };
    const panelBaseBg = theme.mode === 'dark' ? '#1A2330' : '#FFFFFF';
    const _panelTextColor = getReadable(panelBaseBg); // currently unused
    // Background radial defaults (local-only). Allow user to save current as default and restore.
    const [radialDefaultCenter, setRadialDefaultCenter] = useState<string | null>(null);
    const [radialDefaultEdge, setRadialDefaultEdge] = useState<string | null>(null);
    useEffect(() => {
        try {
            const c = localStorage.getItem('pp_radial_default_center');
            const e = localStorage.getItem('pp_radial_default_edge');
            if (c) setRadialDefaultCenter(c);
            if (e) setRadialDefaultEdge(e);
        } catch { }
    }, []);
    const normalizeHexAlpha = (hex: string | undefined | null, fallback: string): string => {
        if (!hex) return fallback;
        if (/^#([0-9a-fA-F]{8})$/.test(hex)) return hex.toUpperCase();
        if (/^#([0-9a-fA-F]{6})$/.test(hex)) return (hex + 'FF').toUpperCase();
        return fallback;
    };
    const saveRadialDefaults = () => {
        const center = normalizeHexAlpha(theme.backgroundRadialCenter, '#FFFFFF00');
        const edge = normalizeHexAlpha(theme.backgroundRadialEdge, '#FFFFFF00').slice(0, 7) + '00'; // ensure edge has 00 alpha
        try {
            localStorage.setItem('pp_radial_default_center', center);
            localStorage.setItem('pp_radial_default_edge', edge);
        } catch { }
        setRadialDefaultCenter(center);
        setRadialDefaultEdge(edge);
    };
    const restoreRadialDefaults = () => {
        if (!radialDefaultCenter && !radialDefaultEdge) return;
        updateTheme({ backgroundRadialCenter: radialDefaultCenter || undefined, backgroundRadialEdge: radialDefaultEdge || undefined });
    };
    const hasRadialDefaults = !!(radialDefaultCenter || radialDefaultEdge);
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
                                className={`group relative px-4 py-3 rounded-2xl text-left flex-1 lg:flex-none transition shadow-sm ring-1 ${activeState ? 'bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white ring-transparent' : (theme.mode === 'dark' ? 'bg-[#1A2330]/75 hover:bg-[#1A2330]/85 ring-[#263243]/70' : 'bg-white/70 hover:bg-white ring-white/60')}`}
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
                                        <input value={brandName} onChange={e => { setBrandName(e.target.value); markBrandDirty(); }} placeholder="Enter brand name" className="h-11 px-3 rounded-xl bg-white/70 ring-1 ring-white/60 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-from)]" />
                                        <div className="flex items-center gap-3 pt-2">
                                            <button type="button" onClick={forceSaveBrand} disabled={brandSaveStatus === 'saving'} className={`px-4 h-9 rounded-xl text-[11px] font-semibold ring-1 ${(brandSaveStatus === 'saving') ? 'opacity-60 cursor-wait' : 'hover:bg-white'} bg-white/70 ring-white/60`}>Save Brand</button>
                                            {brandSaveStatus === 'saved' && <span className="text-[10px] font-semibold text-green-600">Saved</span>}
                                            {brandSaveStatus === 'error' && <span className="text-[10px] font-semibold text-red-600">{brandSaveError || 'Error'}</span>}
                                            {isBrandDirty && brandSaveStatus === 'idle' && <span className="text-[10px] font-medium opacity-70">Unsaved changes</span>}
                                        </div>
                                    </label>
                                    <div className="space-y-5">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>Logos (PNG / SVG)</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                            <LogoUploader label="Horizontal (Light)" value={brandLogoHorizontal} onChange={setBrandLogoHorizontal} clearLabel="Clear" accentColor={accentColor} aspectHint="Wide header mark" />
                                            <LogoUploader label="Horizontal (Dark)" value={brandLogoHorizontalDark} onChange={setBrandLogoHorizontalDark} clearLabel="Clear" accentColor={accentColor} aspectHint="Dark mode header mark" />
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
                                                            className={`px-3 h-9 rounded-xl text-[11px] font-semibold ring-1 transition ${active ? 'bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white ring-transparent shadow' : (theme.mode === 'dark' ? 'bg-[#1A2330]/75 hover:bg-[#1A2330]/85 ring-[#263243]/70' : 'bg-white/70 hover:bg-white ring-white/60')}`}
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
                                                    <button type="button" onClick={() => setBrandLogoSize(Math.max(0.4, +(brandLogoSize - 0.1).toFixed(2)))} className="px-2 h-8 rounded-lg text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60" style={{ color: accentColor }}>-</button>
                                                    <button type="button" onClick={() => setBrandLogoSize(Math.min(2, +(brandLogoSize + 0.1).toFixed(2)))} className="px-2 h-8 rounded-lg text-[11px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60" style={{ color: accentColor }}>+</button>
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
                                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden relative ring-1 ${theme.mode === 'dark' ? 'bg-[#1A2330]/75 ring-[#263243]/70' : 'bg-white/70 ring-white/60'}`}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                {brandFavicon ? <img src={brandFavicon} alt="Favicon" className="object-contain max-w-full max-h-full" /> : <span className="text-[9px] font-medium opacity-60">None</span>}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className={`px-4 h-10 rounded-xl text-[12px] font-semibold ring-1 flex items-center gap-2 cursor-pointer ${theme.mode === 'dark' ? 'bg-[#1A2330]/75 hover:bg-[#1A2330]/85 ring-[#263243]/70' : 'bg-white/70 hover:bg-white ring-white/60'}`}>Upload
                                                    <input type="file" accept="image/png" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { setBrandFavicon(reader.result as string); }; reader.readAsDataURL(file); }} />
                                                </label>
                                                {brandFavicon && <button type="button" onClick={() => setBrandFavicon('')} className={`px-4 h-10 rounded-xl text-[12px] font-semibold ring-1 ${theme.mode === 'dark' ? 'bg-[#1A2330]/65 hover:bg-[#1A2330]/75 ring-[#263243]/70' : 'bg-white/60 hover:bg-white ring-white/60'}`}>Clear</button>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className={`p-5 rounded-2xl ring-1 space-y-4 ${theme.mode === 'dark' ? 'bg-[#1A2330]/75 ring-[#263243]/70' : 'bg-white/70 ring-white/60'}`} style={{ color: getReadable(theme.mode === 'dark' ? '#1A2330' : '#FFFFFF') }}>
                                        <div className="text-[11px] font-semibold uppercase tracking-wide">Preview</div>
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                {brandLogoVariant === 'icon-text' && brandLogoIcon && <img src={brandLogoIcon} alt="Icon" className="object-contain max-w-full max-h-full" />}
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                {brandLogoVariant !== 'text' && brandLogoVariant !== 'icon-text' && (() => { const map: Record<string, string> = { horizontal: theme.mode === 'dark' && brandLogoHorizontalDark ? brandLogoHorizontalDark : brandLogoHorizontal, vertical: brandLogoVertical, icon: brandLogoIcon }; const src = map[brandLogoVariant]; if (src) return <img src={src} alt="Logo" className="object-contain max-w-full max-h-full" />; return <span className="text-[10px] font-bold opacity-70" style={{ color: accentColor }}>Logo</span>; })()}
                                                {(brandLogoVariant === 'text' || (brandLogoVariant === 'icon-text' && !brandLogoIcon)) && <span className="text-[10px] font-bold opacity-70" style={{ color: accentColor }}>Logo</span>}
                                            </div>
                                            <div className="flex flex-col">
                                                {(brandLogoVariant === 'text' || brandLogoVariant === 'icon-text') && <span className="text-lg font-black bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-transparent bg-clip-text leading-none drop-shadow-sm">{brandName || 'Brand Name'}</span>}
                                                {brandLogoVariant !== 'text' && brandLogoVariant !== 'icon-text' && <span className="text-lg font-black opacity-80">{brandName || 'Brand Name'}</span>}
                                                <span className="text-[10px] font-medium opacity-70">Dashboard Heading</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="w-5 h-5 rounded bg-white/80 ring-1 ring-white/60 overflow-hidden">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
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
                {/* Brand Colors section intentionally merged elsewhere; removed duplicate broken blocks */}
                {active === 'appearance' && (
                    <div className="space-y-10">
                        <div>
                            <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] mb-4" style={{ color: accentColor }}>Appearance</h2>
                            <p className="text-[11px] font-medium mb-6 max-w-2xl" style={{ color: accentColor, opacity: .8 }}>Toggle overall light or dark mode. Dark mode adjusts surfaces & text while keeping your gradient colors. You can still fine‑tune individual colors in Brand Colors.</p>
                            <div className="flex flex-wrap items-center gap-6">
                                <div className="p-5 rounded-2xl bg-white/70 ring-1 ring-white/60 flex flex-col gap-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>Color Mode</div>
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={() => {
                                            if (theme.mode === 'light') return;
                                            // Light palette refresh (keeps gradient stops)
                                            updateTheme({
                                                mode: 'light',
                                                background: '#F9FAFB',
                                                cardBg: '#FFFFFF',
                                                mutedBg: '#F3F4F6',
                                                border: '#E5E7EB',
                                                primaryText: '#111827',
                                                secondaryText: '#6B7280',
                                                sidebarText: '#374151',
                                                headerText: '#111827',
                                                backgroundRadialCenter: theme.backgroundRadialCenter || '#ffffffFF',
                                                backgroundRadialEdge: '#ffffff00'
                                            });
                                        }}
                                            className={`px-4 h-10 rounded-xl text-[12px] font-semibold ring-1 transition ${theme.mode !== 'dark' ? 'bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white ring-transparent shadow' : 'bg-[#1E293B]/80 hover:bg-[#1E293B]/90 ring-[#334155]/60'}`}>Light</button>
                                        <button type="button" onClick={() => {
                                            if (theme.mode === 'dark') return;
                                            // Rich dark palette (slightly elevated surfaces, subtle radial glow)
                                            updateTheme({
                                                mode: 'dark',
                                                background: '#0E1116',
                                                cardBg: '#1A2330',
                                                mutedBg: '#141B25',
                                                border: '#263243',
                                                primaryText: '#F1F5F9',
                                                secondaryText: '#94A3B8',
                                                sidebarText: '#E2E8F0',
                                                headerText: '#F8FAFC',
                                                backgroundRadialCenter: '#1E293BFF', // deep slate/blue center glow
                                                backgroundRadialEdge: '#0E111600'    // fully transparent edge (100% transparency)
                                            });
                                        }}
                                            className={`px-4 h-10 rounded-xl text-[12px] font-semibold ring-1 transition ${(theme.mode as string) === 'dark' ? 'bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-white ring-transparent shadow' : 'bg-white/80 hover:bg-white ring-white/60'}`}>Dark</button>
                                    </div>
                                    <div className="text-[10px] font-medium opacity-70" style={{ color: accentColor }}>Switching modes swaps surface & text palette to optimized values. Gradient stops stay the same, so your brand identity remains intact.</div>
                                </div>
                                <div className={`p-5 rounded-2xl ring-1 flex flex-col gap-4 ${theme.mode === 'dark' ? 'bg-[#1A2330]/75 ring-[#263243]/70' : 'bg-white/70 ring-white/60'}`}>
                                    <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>Background Layers</div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex flex-col gap-1 text-[10px] font-semibold" style={{ color: accentColor }}>
                                            Radial Center
                                            {(() => {
                                                const raw = theme.backgroundRadialCenter || '#ffffff';
                                                const norm = /^#([0-9a-fA-F]{8})$/.test(raw) ? raw : (/^#([0-9a-fA-F]{6})$/.test(raw) ? raw + 'FF' : '#ffffffFF');
                                                const base = norm.slice(0, 7); // #RRGGBB
                                                const alphaHex = norm.slice(7, 9);
                                                const alphaPct = Math.round(parseInt(alphaHex, 16) / 255 * 100);
                                                const setBase = (hex: string) => {
                                                    const next = hex + alphaHex;
                                                    updateTheme({ backgroundRadialCenter: next });
                                                };
                                                const setAlpha = (pct: number) => {
                                                    const clamped = Math.max(0, Math.min(100, pct));
                                                    const a = Math.round(clamped / 100 * 255).toString(16).padStart(2, '0').toUpperCase();
                                                    updateTheme({ backgroundRadialCenter: base + a });
                                                };
                                                return (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <input type="color" value={base} onChange={e => setBase(e.target.value)} className="h-9 w-9 rounded-lg cursor-pointer bg-transparent border border-white/60" />
                                                            <input value={base} onChange={e => setBase(e.target.value)} className={`flex-1 h-9 px-2 rounded-lg ring-1 text-[11px] font-medium ${theme.mode === 'dark' ? 'bg-[#1A2330]/75 ring-[#263243]/70' : 'bg-white/70 ring-white/60'}`} />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <input type="range" min={0} max={100} value={alphaPct} onChange={e => setAlpha(parseInt(e.target.value))} className="flex-1 accent-[var(--brand-from)]" />
                                                            <span className="w-10 text-right tabular-nums">{alphaPct}%</span>
                                                        </div>
                                                        <div className="text-[9px] font-medium opacity-70">Hex w/ Alpha: {base + alphaHex}</div>
                                                    </div>
                                                );
                                            })()}
                                        </label>
                                        <label className="flex flex-col gap-1 text-[10px] font-semibold" style={{ color: accentColor }}>
                                            Radial Edge
                                            {(() => {
                                                const raw = theme.backgroundRadialEdge || '#ffffff00';
                                                const norm = /^#([0-9a-fA-F]{8})$/.test(raw) ? raw : (/^#([0-9a-fA-F]{6})$/.test(raw) ? raw + '00' : '#ffffff00');
                                                const base = norm.slice(0, 7);
                                                const alphaHex = norm.slice(7, 9);
                                                const alphaPct = Math.round(parseInt(alphaHex, 16) / 255 * 100);
                                                const setBase = (hex: string) => {
                                                    const next = hex + alphaHex;
                                                    updateTheme({ backgroundRadialEdge: next });
                                                };
                                                const setAlpha = (pct: number) => {
                                                    const clamped = Math.max(0, Math.min(100, pct));
                                                    const a = Math.round(clamped / 100 * 255).toString(16).padStart(2, '0').toUpperCase();
                                                    updateTheme({ backgroundRadialEdge: base + a });
                                                };
                                                return (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <input type="color" value={base} onChange={e => setBase(e.target.value)} className="h-9 w-9 rounded-lg cursor-pointer bg-transparent border border-white/60" />
                                                            <input value={base} onChange={e => setBase(e.target.value)} className={`flex-1 h-9 px-2 rounded-lg ring-1 text-[11px] font-medium ${theme.mode === 'dark' ? 'bg-[#1A2330]/75 ring-[#263243]/70' : 'bg-white/70 ring-white/60'}`} />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <input type="range" min={0} max={100} value={alphaPct} onChange={e => setAlpha(parseInt(e.target.value))} className="flex-1 accent-[var(--brand-from)]" />
                                                            <span className="w-10 text-right tabular-nums">{alphaPct}%</span>
                                                        </div>
                                                        <div className="text-[9px] font-medium opacity-70">Hex w/ Alpha: {base + alphaHex}</div>
                                                    </div>
                                                );
                                            })()}
                                        </label>
                                    </div>
                                    <div className="flex flex-wrap gap-3 pt-2">
                                        <button type="button" onClick={saveRadialDefaults}
                                            className={`px-3 h-9 rounded-xl text-[11px] font-semibold ring-1 ${theme.mode === 'dark' ? 'bg-[#1A2330]/75 hover:bg-[#1A2330]/85 ring-[#263243]/70' : 'bg-white/70 hover:bg-white ring-white/60'}`}
                                            style={{ color: accentColor }}
                                        >Save as Default</button>
                                        {hasRadialDefaults && (
                                            <button type="button" onClick={restoreRadialDefaults}
                                                className={`px-3 h-9 rounded-xl text-[11px] font-semibold ring-1 ${theme.mode === 'dark' ? 'bg-[#1A2330]/65 hover:bg-[#1A2330]/75 ring-[#263243]/70' : 'bg-white/60 hover:bg-white ring-white/60'}`}
                                                style={{ color: accentColor }}
                                            >Reset to Default</button>
                                        )}
                                        {hasRadialDefaults && radialDefaultCenter && (
                                            <span className="text-[10px] font-medium opacity-70 flex items-center gap-2" style={{ color: accentColor }}>
                                                <span className="inline-flex items-center gap-1">Default Center:<span className="font-semibold">{radialDefaultCenter}</span></span>
                                                {radialDefaultEdge && <span className="inline-flex items-center gap-1">Edge:<span className="font-semibold">{radialDefaultEdge}</span></span>}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] font-medium opacity-70" style={{ color: accentColor }}>Customize the center and edge colors of the subtle radial glow behind your interface (light mode only currently).</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* (Duplicate brand section removed) */}
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
                            <div className={`mt-8 p-5 rounded-2xl ring-1 space-y-4 ${theme.mode === 'dark' ? 'bg-[#1A2330]/75 ring-[#263243]/70' : 'bg-white/70 ring-white/60'}`}>
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
                        <p className="text-[11px] font-medium" style={{ color: accentColor, opacity: .85 }}>Upload a CSV of leads. You can optionally force all rows to a single Source below. After import duplicates (same phone) are auto merged.</p>
                        <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium">
                            <div className="flex items-center gap-2">
                                <span style={{ color: accentColor }} className="font-semibold uppercase tracking-wide">Override Source</span>
                                <select value={importSource} onChange={e => setImportSource(e.target.value)} className="h-10 px-2 rounded-xl bg-white/70 ring-1 ring-white/60 text-[11px] font-semibold">
                                    <option value=''>-- Keep From File --</option>
                                    {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 select-none">
                                <input type="checkbox" checked={treatDuplicateLeadIdsAsUpdates} onChange={e => setTreatDuplicateLeadIdsAsUpdates(e.target.checked)} className="accent-[var(--brand-from)]" />
                                <span className="text-[10px] font-semibold" style={{ color: accentColor }}>Duplicate Lead ID = Update (uncheck to force new IDs)</span>
                            </label>
                            <button type="button" onClick={() => {
                                // Generate template CSV
                                const headers = [
                                    'Lead ID', 'Customer Name', 'Contact Info', 'Source (Facebook/Instagram/WhatsApp/TikTok)', 'Date Entered', 'Date First Called', 'First Call Status (Voicemail/Answered/Interested/Not Interested)', 'Notes from First Call', 'Date Second Call', 'Second Call Status (They Called/We Called/Voicemail/Answered)', 'Second Call Notes', 'Date Registered', 'Final Status (Registered/Not Registered/Follow-up Needed)', 'Final Notes'
                                ];
                                const sample = [
                                    '123', 'Jane Doe', '555-111-2222 | jane@example.com', 'Instagram', '2025-08-10', '2025-08-11', 'Answered', 'Interested in program', '2025-08-15', 'We Called', 'Left detailed VM', '2025-08-20', 'Registered', 'Paid in full'
                                ];
                                const csv = [headers.join(','), sample.map(v => '"' + v.replace(/"/g, '""') + '"').join(',')].join('\n');
                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = 'leads-template.csv'; a.click();
                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                            }} className="inline-flex items-center gap-2 px-3 h-10 rounded-xl bg-white/70 hover:bg-white ring-1 ring-white/60 font-semibold">
                                <Download size={14} /> Template
                            </button>
                            <button
                                type="button"
                                disabled={forceSyncStatus.running}
                                onClick={async () => {
                                    setForceSyncStatus({ running: true, msg: null });
                                    try {
                                        const res = await forceSync();
                                        setForceSyncStatus({ running: false, msg: `Synced ${res.added} new / ${res.skipped} existing` });
                                        setTimeout(() => setForceSyncStatus(s => s.running ? s : { running: false, msg: null }), 4000);
                                    } catch (e) {
                                        console.error(e);
                                        setForceSyncStatus({ running: false, msg: 'Sync failed (see console)' });
                                        setTimeout(() => setForceSyncStatus(s => s.running ? s : { running: false, msg: null }), 5000);
                                    }
                                }}
                                className="inline-flex items-center gap-2 px-3 h-10 rounded-xl bg-white/70 hover:bg-white ring-1 ring-white/60 font-semibold disabled:opacity-50"
                            >
                                {forceSyncStatus.running ? 'Syncing…' : 'Force Sync to Cloud'}
                            </button>
                            {forceSyncStatus.msg && (
                                <span className="text-[10px] font-semibold opacity-80">{forceSyncStatus.msg}</span>
                            )}
                        </div>
                        <label className={`relative flex flex-col items-center justify-center gap-3 h-52 border-2 border-dashed rounded-2xl cursor-pointer transition ${importing ? 'opacity-60 pointer-events-none' : (theme.mode === 'dark' ? 'hover:bg-[#1A2330]/70' : 'hover:bg-white')} ${theme.mode === 'dark' ? 'bg-[#1A2330]/55 border-[#263243]/70 ring-1 ring-[#263243]/70' : 'bg-white/60 ring-1 ring-white/60'}`}>
                            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
                                const file = e.target.files?.[0]; if (!file) return; setImportResult(null); setImporting(true);
                                Papa.parse(file, {
                                    header: true, skipEmptyLines: true, complete: async (results) => {
                                        try {
                                            const rows = results.data as Record<string, unknown>[];
                                            if (!rows.length) { setImporting(false); return; }
                                            const existingIds = new Set<string>(customersForExport.map(c => c.id));
                                            let created = 0; let updated = 0;
                                            const toCustomers = rows.map((row, idx) => {
                                                const asStr = (v: unknown) => (v ?? '').toString().trim();
                                                // Helper to fetch first non-empty of multiple possible headers
                                                const pick = (alts: string[]) => {
                                                    for (const k of alts) {
                                                        if (row.hasOwnProperty(k) && asStr(row[k]).length) return asStr(row[k]);
                                                    }
                                                    return '';
                                                };
                                                // Phone / Email extraction: support either combined Contact Info or separate Phone/Email columns
                                                let phone = '';
                                                let email: string | undefined;
                                                const contactRaw = pick(['Contact Info']);
                                                if (contactRaw) {
                                                    if (contactRaw.includes('|')) {
                                                        const parts = contactRaw.split('|').map(p => p.trim());
                                                        parts.forEach(p => { if (!email && /@/.test(p)) email = p; });
                                                        const phoneCandidate = parts.find(p => /\d/.test(p) && !/@/.test(p));
                                                        phone = phoneCandidate ? phoneCandidate.replace(/\s+/g, ' ') : '';
                                                    } else if (/@/.test(contactRaw)) {
                                                        email = contactRaw;
                                                    } else {
                                                        phone = contactRaw;
                                                    }
                                                } else {
                                                    phone = pick(['Phone']);
                                                    const emailRaw = pick(['Email']);
                                                    if (emailRaw) email = emailRaw;
                                                }
                                                const sourceRaw = pick(['Source', 'Source (Facebook/Instagram/WhatsApp/TikTok)']);
                                                const sourceFinal = (importSource || sourceRaw) as string;
                                                let rawLeadId = pick(['Lead ID', 'leadId', 'ID']);
                                                if (!rawLeadId) rawLeadId = `imp_${Date.now()}_${idx}`;
                                                let leadId = rawLeadId.trim();
                                                let duplicate = existingIds.has(leadId);
                                                if (duplicate) {
                                                    if (treatDuplicateLeadIdsAsUpdates) {
                                                        updated++;
                                                    } else {
                                                        leadId = `imp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
                                                        duplicate = false;
                                                        created++;
                                                    }
                                                } else {
                                                    created++;
                                                }
                                                existingIds.add(leadId);
                                                const firstCallStatus = pick(['First Call Status', 'First Call Status (Voicemail/Answered/Interested/Not Interested)']);
                                                const secondCallStatus = pick(['Second Call Status', 'Second Call Status (They Called/We Called/Voicemail/Answered)']);
                                                const finalStatus = pick(['Final Status', 'Final Status (Registered/Not Registered/Follow-up Needed)']);
                                                return {
                                                    leadId,
                                                    name: pick(['Customer Name', 'Name']),
                                                    phone,
                                                    email,
                                                    country: undefined,
                                                    source: sourceFinal,
                                                    dateAdded: pick(['Date Entered', 'Date Added', 'Created', 'dateAdded']),
                                                    firstCallDate: pick(['Date First Called', 'First Call Date', 'firstCallDate']),
                                                    firstCallStatus,
                                                    notes: pick(['Notes from First Call', 'First Call Notes', 'notes']),
                                                    secondCallDate: pick(['Date Second Call', 'Second Call Date', 'secondCallDate']),
                                                    secondCallStatus,
                                                    secondCallNotes: pick(['Second Call Notes', 'secondCallNotes']),
                                                    finalCallDate: pick(['Date Registered', 'Final Call Date', 'finalCallDate']),
                                                    finalStatus,
                                                    finalNotes: pick(['Final Notes', 'finalNotes']),
                                                    pronouns: undefined,
                                                    device: undefined,
                                                    leadScore: undefined,
                                                    lastUpdated: new Date().toISOString(),
                                                    lastMessageSnippet: undefined,
                                                    messageCount: undefined,
                                                };
                                            });
                                            await bulkUpsert({ instanceId, customers: toCustomers });
                                            const dedupeResult = await dedupePhonesMutation({ instanceId });
                                            setImportResult({ rows: toCustomers.length, merged: dedupeResult.merged || 0, removed: dedupeResult.removed || 0, created, updated });
                                            // Helpful console diagnostics (development only)
                                            if (process.env.NODE_ENV !== 'production') {
                                                console.groupCollapsed('[Import Diagnostics]');
                                                console.log('Rows parsed', rows.length);
                                                console.log('Created (new IDs)', created, 'Updated (existing IDs)', updated);
                                                console.log('Deduper merged', dedupeResult.merged, 'removed', dedupeResult.removed);
                                                console.log('Treat duplicates as updates?', treatDuplicateLeadIdsAsUpdates);
                                                console.groupEnd();
                                            }
                                        } catch (err) {
                                            console.error(err);
                                        } finally {
                                            setImporting(false);
                                        }
                                    }
                                });
                            }} />
                            <span className="text-[12px] font-semibold">{importing ? 'Importing…' : 'Click or Drop CSV'}</span>
                            <span className="text-[10px] font-medium opacity-60">Max ~5MB • UTF‑8</span>
                            {importResult && (
                                <div className="absolute bottom-3 left-3 right-3 text-[10px] font-semibold bg-white/80 rounded-lg px-2 py-1 text-gray-700 space-y-0.5">
                                    <div>Imported {importResult.rows} rows • New {importResult.created} • Updated {importResult.updated}</div>
                                    {(importResult.merged > 0 || importResult.removed > 0) && <div className="text-[9px] font-medium opacity-70">Post-import merge: {importResult.merged} merged • {importResult.removed} removed</div>}
                                </div>
                            )}
                        </label>
                        <div className="text-[10px] font-medium opacity-70 leading-relaxed" style={{ color: accentColor }}>
                            Required headers: Lead ID, Customer Name, Contact Info, Source (Facebook/Instagram/WhatsApp/TikTok), Date Entered, Date First Called, First Call Status (Voicemail/Answered/Interested/Not Interested), Notes from First Call, Date Second Call, Second Call Status (They Called/We Called/Voicemail/Answered), Second Call Notes, Date Registered, Final Status (Registered/Not Registered/Follow-up Needed), Final Notes.
                            Contact Info supports &quot;phone | email&quot; combined or just phone or email.
                        </div>
                    </div>
                )}
                {active === 'export' && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: accentColor }}>Export & Backup</h2>
                        <p className="text-[11px] font-medium" style={{ color: accentColor, opacity: .85 }}>Download a full CSV snapshot of all customers plus theme JSON backup.</p>
                        <div className="flex flex-wrap gap-3">
                            <button onClick={exportTheme} className="px-4 h-11 rounded-xl text-[12px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60">Download Theme JSON</button>
                            <button onClick={() => {
                                try {
                                    const rows = customersForExport || [];
                                    if (!rows.length) { alert('No customers to export'); return; }
                                    const headers = [
                                        'Lead ID', 'Customer Name', 'Phone', 'Email', 'Source', 'Date Entered', 'Date First Called', 'First Call Status', 'Notes from First Call', 'Date Second Call', 'Second Call Status', 'Second Call Notes', 'Date Registered', 'Final Status', 'Final Notes', 'Duplicate Lead IDs', 'Duplicate Dates'
                                    ];
                                    const esc = (v: unknown) => '"' + (v == null ? '' : String(v).replace(/"/g, '""')) + '"';
                                    const csvLines = [headers.join(',')];
                                    for (const c of rows) {
                                        csvLines.push([
                                            esc(c.id), esc(c.name), esc(c.phone), esc(c.email || ''), esc(c.source), esc(c.dateAdded), esc(c.firstCallDate), esc(c.firstCallStatus), esc(c.notes), esc(c.secondCallDate), esc(c.secondCallStatus), esc(c.secondCallNotes), esc(c.finalCallDate), esc(c.finalStatus), esc(c.finalNotes), esc((c.duplicateLeadIds || []).join('|')), esc((c.duplicateDateAdds || []).join('|'))
                                        ].join(','));
                                    }
                                    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url; a.download = 'customers-export.csv'; a.click();
                                    setTimeout(() => URL.revokeObjectURL(url), 1200);
                                } catch (e) { console.error(e); }
                            }} className="px-4 h-11 rounded-xl text-[12px] font-semibold bg-white/70 hover:bg-white ring-1 ring-white/60">Download Customers CSV</button>
                        </div>
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
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: accentColor }}>Advanced</h2>
                            <p className="text-[11px] font-medium" style={{ color: accentColor, opacity: .85 }}>Developer backups: create code snapshots (optionally archived) before major edits.</p>
                        </div>
                        <AdvancedBackupTools accentColor={accentColor} />
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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

// Removed unused helper components (ColorSuggestions, StatusColorEditors, ThemeIO, ColorInput) to satisfy lint no-unused-vars warnings.

// Developer backup tools component (re-added)
function AdvancedBackupTools({ accentColor }: { accentColor: string }) {
    const [backups, setBackups] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [creating, setCreating] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const reload = async () => {
        setLoadingList(true); setError(null);
        try {
            const res = await fetch('/api/dev/backups', { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'List failed');
            setBackups(data.backups || []);
        } catch (e: any) { setError(e.message); }
        finally { setLoadingList(false); }
    };
    useEffect(() => { reload(); }, []);
    const createBackup = async (archive: boolean) => {
        if (creating) return;
        setCreating(true); setMessage(null); setError(null);
        try {
            const res = await fetch('/api/dev/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: archive ? 'ui-arch' : 'ui', archive }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Backup failed');
            setMessage(`Snapshot ${data.snapshot} (${data.files} files${data.archived ? ', archived' : ''})`);
            await reload();
        } catch (e: any) { setError(e.message); }
        finally { setCreating(false); }
    };
    return (
        <div className="rounded-2xl bg-white/50 ring-1 ring-white/60 p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <button disabled={creating} onClick={() => createBackup(false)} className="px-4 h-10 rounded-xl text-[11px] font-semibold bg-white/80 hover:bg-white ring-1 ring-white/60 disabled:opacity-50">{creating ? 'Working…' : 'Backup (Folder)'}</button>
                <button disabled={creating} onClick={() => createBackup(true)} className="px-4 h-10 rounded-xl text-[11px] font-semibold bg-white/80 hover:bg-white ring-1 ring-white/60 disabled:opacity-50">{creating ? 'Working…' : 'Backup + Archive'}</button>
                <button disabled={loadingList} onClick={reload} className="px-3 h-10 rounded-xl text-[11px] font-semibold bg-white/60 hover:bg-white ring-1 ring-white/60 disabled:opacity-50">Refresh</button>
            </div>
            {message && <div className="text-[11px] font-medium" style={{ color: accentColor }}>{message}</div>}
            {error && <div className="text-[11px] font-medium text-red-600">{error}</div>}
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {loadingList && <div className="text-[11px] opacity-70">Loading backups…</div>}
                {!loadingList && backups.length === 0 && <div className="text-[11px] opacity-70">No snapshots yet.</div>}
                {backups.map(b => {
                    const archiveName = b.archived ? `${b.name}.tar.gz` : null;
                    return (
                        <div key={b.name} className="flex items-center gap-3 text-[11px] bg-white/70 rounded-xl px-3 py-2">
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate" style={{ color: accentColor }}>{b.name}</div>
                                <div className="opacity-70">{b.files ?? '—'} files • tag: {b.tag} {b.archived ? '• archived' : ''}</div>
                            </div>
                            {archiveName && <a href={`/api/dev/backup/download?name=${archiveName}`} className="px-3 h-8 rounded-lg font-semibold bg-white/80 hover:bg-white ring-1 ring-white/60 flex items-center">Download</a>}
                        </div>
                    );
                })}
            </div>
            <div className="text-[10px] leading-relaxed opacity-70" style={{ color: accentColor }}>
                Excludes: node_modules, .next, backups, .git, __pycache__. Use archive for a portable .tar.gz. Keep secrets safe.
            </div>
        </div>
    );
}
