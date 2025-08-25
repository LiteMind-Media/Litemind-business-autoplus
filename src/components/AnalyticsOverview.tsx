"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Customer, SOURCE_OPTIONS, FINAL_STATUS_OPTIONS } from "@/types/customer";

type Props = {
    data: Customer[];
    remoteCount?: number; // raw rows in Convex
    localCount?: number;  // local session rows
    uniquePhoneCount?: number; // deduped by phone
};

export default function AnalyticsOverview({ data, remoteCount, localCount, uniquePhoneCount }: Props) {
    const stats = useMemo(() => {
        const total = data.length;
        const needFirstContact = data.filter(c => !c.firstCallDate).length;
        const needFirstCallStatus = data.filter(c => c.firstCallDate && !c.firstCallStatus).length;
        const needSecondContact = data.filter(c => !c.secondCallDate && !c.secondCallStatus).length;
        const registered = data.filter(c => c.finalStatus === 'Registered').length;
        const notRegistered = data.filter(c => c.finalStatus === 'Not Registered').length;
        const followUp = data.filter(c => c.finalStatus === 'Follow-up Needed').length;

        const bySource = SOURCE_OPTIONS.reduce<Record<string, number>>((acc, s) => {
            acc[s] = data.filter(c => c.source === s).length;
            return acc;
        }, {});

        const byFinal = FINAL_STATUS_OPTIONS.reduce<Record<string, number>>((acc, s) => {
            acc[s] = data.filter(c => c.finalStatus === s).length;
            return acc;
        }, {});

        return { total, needFirstContact, needFirstCallStatus, needSecondContact, registered, notRegistered, followUp, bySource, byFinal };
    }, [data]);

    const sourceSeries = SOURCE_OPTIONS.map(label => ({ label, value: stats.bySource[label] })).filter(s => s.value > 0);
    const finalSeries = FINAL_STATUS_OPTIONS.map(label => ({ label, value: stats.byFinal[label] })).filter(s => s.value > 0);

    const showCountsBar = remoteCount !== undefined || localCount !== undefined || uniquePhoneCount !== undefined;
    const diff = (remoteCount !== undefined && localCount !== undefined) ? localCount - remoteCount : 0;
    return (
        <div className="space-y-10">
            {showCountsBar && (
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white/70 border border-gray-200 text-[11px] font-medium">
                    {remoteCount !== undefined && <span className="px-2 py-1 rounded-lg bg-gray-900 text-white font-semibold">Cloud {remoteCount.toLocaleString()}</span>}
                    {localCount !== undefined && <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-800 font-semibold">Local {localCount.toLocaleString()}</span>}
                    {uniquePhoneCount !== undefined && <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold">Unique Phones {uniquePhoneCount.toLocaleString()}</span>}
                    {remoteCount !== undefined && localCount !== undefined && diff !== 0 && (
                        <span className={`px-2 py-1 rounded-lg font-semibold ${diff > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{diff > 0 ? '+' + diff : diff} session delta</span>
                    )}
                    <span className="ml-auto text-[10px] opacity-70">Cloud rows = authoritative stored leads; Local may include just-imported rows pending sync / dedupe.</span>
                </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <Stat title="Total Leads" value={stats.total} variant="primary" />
                <Stat title="Need 1st Contact" value={stats.needFirstContact} variant="warning" />
                <Stat title="Need 1st Status" value={stats.needFirstCallStatus} variant="amber" />
                <Stat title="Need 2nd Contact" value={stats.needSecondContact} variant="indigo" />
                <Stat title="Registered" value={stats.registered} variant="success" />
                <Stat title="Follow-ups" value={stats.followUp} variant="info" />
            </div>
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-8">
                <Panel title="Lead Source Distribution">
                    <div className="flex flex-col md:flex-row md:items-center gap-8">
                        <div className="mx-auto">
                            <DonutChart data={sourceSeries} ariaLabel="Lead source distribution" colorFor={(label) => sourceColorMap[label] || '#999'} />
                        </div>
                        <Legend items={sourceSeries} colorFor={(label) => sourceColorMap[label] || '#999'} />
                    </div>
                </Panel>
                <Panel title="Pipeline Outcomes (Final Status)">
                    <div className="flex flex-col gap-8">
                        <BarChart data={finalSeries} ariaLabel="Final status counts" />
                        <Legend items={finalSeries} />
                    </div>
                </Panel>
            </div>
            <PeriodProgressPanel data={data} />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <DailyProgressPanel data={data} />
                <MonthlyProgressPanel data={data} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <FunnelPanel data={data} />
                <SourceConversionPanel data={data} />
            </div>
            <StageVelocityPanel data={data} />
        </div>
    );
}

function Stat({ title, value, variant }: { title: string; value: number; variant?: string }) {
    const variantMap: Record<string, string> = {
        primary: 'from-blue-500 to-blue-600 text-white shadow-blue-500/30',
        warning: 'from-rose-500 to-rose-600 text-white shadow-rose-500/30',
        amber: 'from-amber-400 to-amber-500 text-white shadow-amber-500/30',
        indigo: 'from-indigo-500 to-indigo-600 text-white shadow-indigo-500/30',
        success: 'from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30',
        info: 'from-cyan-500 to-cyan-600 text-white shadow-cyan-500/30',
    };
    const style = variant ? variantMap[variant] : 'from-gray-100 to-gray-200 text-gray-800 shadow-gray-400/10';
    return (
        <div className={`relative rounded-xl p-4 overflow-hidden bg-gradient-to-br ${style} shadow-sm`}>
            <div className="text-[11px] uppercase tracking-wide font-semibold opacity-80">{title}</div>
            <div className="mt-1 text-2xl font-extrabold">{value}</div>
        </div>
    );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white/70 backdrop-blur rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-gray-300 after:to-transparent">{title}</div>
            {children}
        </div>
    );
}

// --- Charts (custom lightweight SVG components) ---

// Stable color assignment (do not shift when some sources have zero values)
const sourceColorMap: Record<string, string> = {
    'Instagram': '#2563eb', // blue
    'Facebook': '#6366f1',  // indigo
    'TikTok': '#7c3aed',    // violet
    'WhatsApp': '#059669',  // emerald
    'Web Form': '#f59e0b',  // amber
};

// Generic fallback palette for other categorical series
const palette = [
    '#2563eb', // blue-600
    '#db2777', // rose-600
    '#f59e0b', // amber-500
    '#6366f1', // indigo-500
    '#059669', // emerald-600
    '#0891b2', // cyan-600
    '#7c3aed', // violet-600
    '#f97316', // orange-500
];

interface ChartDatum { label: string; value: number; }

function Legend({ items, colorFor }: { items: ChartDatum[]; colorFor?: (label: string, index: number) => string }) {
    return (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm" aria-label="Legend">
            {items.map((d, idx) => (
                <li key={d.label} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: colorFor ? colorFor(d.label, idx) : palette[idx % palette.length] }} aria-hidden />
                    <span className="text-gray-700 flex-1 truncate">{d.label}</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{d.value}</span>
                </li>
            ))}
            {items.length === 0 && <li className="text-xs text-gray-400 italic">No data</li>}
        </ul>
    );
}

function DonutChart({ data, ariaLabel, colorFor }: { data: ChartDatum[]; ariaLabel: string; colorFor?: (label: string, index: number) => string }) {
    const total = data.reduce((a, b) => a + b.value, 0);
    const center = 70;
    const radius = 60;
    const stroke = 18;
    let cumulative = 0;
    const paths = data.length === 1 ? (
        // Special case: full circle (single category) or else arc path collapses
        <circle cx={center} cy={center} r={radius} stroke={colorFor ? colorFor(data[0].label, 0) : palette[0]} strokeWidth={stroke} fill="none" />
    ) : data.map((d, i) => {
        const startAngle = (cumulative / total) * Math.PI * 2;
        cumulative += d.value;
        const endAngle = (cumulative / total) * Math.PI * 2;
        const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
        const sx = center + radius * Math.cos(startAngle);
        const sy = center + radius * Math.sin(startAngle);
        const ex = center + radius * Math.cos(endAngle);
        const ey = center + radius * Math.sin(endAngle);
        const pathData = `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`;
        return <path key={d.label} d={pathData} stroke={colorFor ? colorFor(d.label, i) : palette[i % palette.length]} strokeWidth={stroke} fill="none" strokeLinecap="butt" />;
    });
    return (
        <figure className="relative" aria-label={ariaLabel} role="img">
            <svg width={140} height={140} viewBox="0 0 140 140" className="overflow-visible">
                <circle cx={center} cy={center} r={radius} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
                {paths}
                <circle cx={center} cy={center} r={radius - stroke} fill="white" />
                <text x={center} y={center - 4} textAnchor="middle" className="fill-gray-900 font-bold text-[18px]">{total}</text>
                <text x={center} y={center + 14} textAnchor="middle" className="fill-gray-500 text-[10px] font-medium">Total</text>
            </svg>
        </figure>
    );
}

function BarChart({ data, ariaLabel }: { data: ChartDatum[]; ariaLabel: string }) {
    const max = Math.max(1, ...data.map(d => d.value));
    return (
        <figure className="space-y-3" aria-label={ariaLabel} role="img">
            {data.length === 0 && <div className="text-xs text-gray-400 italic">No data</div>}
            {data.map((d, i) => {
                const pct = (d.value / max) * 100;
                return (
                    <div key={d.label} className="flex items-center gap-3">
                        <div className="w-32 text-[11px] font-medium text-gray-600 truncate">{d.label}</div>
                        <div className="flex-1 h-4 bg-gray-100 rounded-md overflow-hidden">
                            <div className="h-full rounded-md transition-all" style={{ width: pct + '%', backgroundColor: palette[i % palette.length] }} />
                        </div>
                        <div className="w-10 text-right text-xs font-semibold text-gray-800 tabular-nums">{d.value}</div>
                    </div>
                );
            })}
        </figure>
    );
}

// --- Period Progress Panel (Weekly / Monthly / Last Month Daily) ---

function PeriodProgressPanel({ data }: { data: Customer[] }) {
    // Aggregate helpers
    const today = new Date();
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    // removed unused dateKey helper
    const parseSafe = (s?: string) => { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d; };
    const addedDates: Date[] = data.map(c => parseSafe(c.dateAdded)).filter((d): d is Date => !!d);

    // Weekly (last 8 weeks including current)
    const weekly = (() => {
        const weeks: { label: string; value: number }[] = [];
        // Determine Monday of current week
        const now = startOfDay(today);
        const day = now.getDay(); // 0 Sun -> convert to Monday start
        const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7));
        for (let i = 7; i >= 0; i--) {
            const start = new Date(monday); start.setDate(monday.getDate() - i * 7);
            const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
            const count = addedDates.filter(d => d >= start && d <= end).length;
            const weekNum = getWeekNumber(start);
            weeks.push({ label: 'W' + weekNum, value: count });
        }
        return weeks;
    })();

    // Monthly (current year months up to current month)
    const monthly = (() => {
        const year = today.getFullYear();
        const arr: { label: string; value: number }[] = [];
        for (let m = 0; m <= today.getMonth(); m++) {
            const start = new Date(year, m, 1, 0, 0, 0, 0);
            const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
            const count = addedDates.filter(d => d >= start && d <= end).length;
            arr.push({ label: start.toLocaleString(undefined, { month: 'short' }), value: count });
        }
        return arr;
    })();

    // Last month daily breakdown
    const lastMonthDaily = (() => {
        const year = today.getFullYear();
        const prevMonth = new Date(year, today.getMonth() - 1, 1);
        const monthIndex = prevMonth.getMonth();
        const start = new Date(prevMonth.getFullYear(), monthIndex, 1, 0, 0, 0, 0);
        const end = new Date(prevMonth.getFullYear(), monthIndex + 1, 0, 23, 59, 59, 999);
        const days: { label: string; value: number }[] = [];
        for (let d = 1; d <= end.getDate(); d++) {
            const ds = new Date(prevMonth.getFullYear(), monthIndex, d, 0, 0, 0, 0);
            const de = new Date(prevMonth.getFullYear(), monthIndex, d, 23, 59, 59, 999);
            const count = addedDates.filter(ad => ad >= ds && ad <= de).length;
            days.push({ label: d.toString(), value: count });
        }
        return { monthLabel: start.toLocaleString(undefined, { month: 'short', year: 'numeric' }), days };
    })();

    return (
        <Panel title="Period Progress">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <MiniBarCard title="Weekly (8 wks)" data={weekly} note="Last 8 weeks" />
                <MiniBarCard title="Monthly" data={monthly} note="YTD" />
                <MiniBarCard title={lastMonthDaily.monthLabel} data={lastMonthDaily.days} note="Daily last month" dense />
            </div>
        </Panel>
    );
}

function MiniBarCard({ title, data, note, dense }: { title: string; data: { label: string; value: number }[]; note?: string; dense?: boolean }) {
    const max = Math.max(1, ...data.map(d => d.value));
    const height = dense ? 90 : 110;
    const barW = dense ? 10 : 16;
    const gap = 6;
    const width = data.length * (barW + gap) + 10;
    return (
        <div className="rounded-xl border border-gray-200 bg-white/60 p-4 flex flex-col">
            <div className="flex items-baseline justify-between mb-2">
                <div className="text-[11px] font-bold uppercase tracking-wide text-gray-600">{title}</div>
                {note && <div className="text-[10px] text-gray-400 font-medium">{note}</div>}
            </div>
            <div className="overflow-x-auto">
                <svg width={width} height={height} role="img" aria-label={title + ' bar chart'}>
                    {data.map((d, i) => {
                        const h = (d.value / max) * (height - 24);
                        const x = i * (barW + gap) + 4;
                        const y = height - 20 - h;
                        return (
                            <g key={d.label}>
                                <rect x={x} y={y} width={barW} height={Math.max(2, h)} rx={3} fill={palette[i % palette.length]} />
                                {h > 18 && <text x={x + barW / 2} y={y + 12} fontSize={9} textAnchor="middle" fill="#ffffff" fontWeight={600}>{d.value}</text>}
                                {h <= 18 && d.value > 0 && <text x={x + barW / 2} y={y - 4} fontSize={9} textAnchor="middle" fill="#111827" fontWeight={600}>{d.value}</text>}
                                <text x={x + barW / 2} y={height - 6} fontSize={8} textAnchor="middle" fill="#6b7280">{d.label}</text>
                            </g>
                        );
                    })}
                </svg>
            </div>
            {data.every(d => d.value === 0) && <div className="mt-2 text-[10px] text-gray-400 italic">No data</div>}
        </div>
    );
}

function getWeekNumber(d: Date) {
    // ISO week number
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Thursday in current week decides the year.
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

// --- Daily Progress (stacked bar) ---

type Timeframe = 'week' | 'month' | 'year' | 'custom';

function DailyProgressPanel({ data }: { data: Customer[] }) {
    const [timeframe, setTimeframe] = useState<Timeframe>('week');
    const [customStart, setCustomStart] = useState<string>(() => {
        const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); // last 30 days default
    });
    const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
    const [mode, setMode] = useState<'count' | 'percent'>('count');
    const [showCumulative, setShowCumulative] = useState(true);
    const [showRolling, setShowRolling] = useState(false);
    const [showInsights, setShowInsights] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const prevOverflowRef = useRef<string | null>(null);
    const enterScrollPosRef = useRef<number>(0);
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setIsFullscreen(false);
        }
        if (isFullscreen) {
            // lock body scroll and scroll viewport to top
            enterScrollPosRef.current = window.scrollY;
            prevOverflowRef.current = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
            window.addEventListener('keydown', handleKey);
        } else {
            window.removeEventListener('keydown', handleKey);
            if (prevOverflowRef.current !== null) {
                document.body.style.overflow = prevOverflowRef.current;
                prevOverflowRef.current = null;
            } else {
                document.body.style.overflow = '';
            }
            // restore previous scroll position
            if (enterScrollPosRef.current > 0) {
                window.requestAnimationFrame(() => window.scrollTo({ top: enterScrollPosRef.current, behavior: 'smooth' }));
            }
        }
        return () => {
            window.removeEventListener('keydown', handleKey);
            if (prevOverflowRef.current !== null) {
                document.body.style.overflow = prevOverflowRef.current;
                prevOverflowRef.current = null;
            } else {
                document.body.style.overflow = '';
            }
        };
    }, [isFullscreen]);

    const { stacks, stageOrder } = useMemo(() => {
        // Stage derivation similar to Kanban
        function stage(c: Customer): string {
            if (c.finalStatus === 'Registered') return 'Registered';
            if (c.finalStatus === 'Follow-up Needed' || c.finalStatus === 'Not Registered') return 'Final Other';
            if (c.secondCallDate || c.secondCallStatus) return '2nd Contact';
            if (c.firstCallStatus) return '1st Status';
            if (c.firstCallDate) return '1st Contact';
            return 'New';
        }
        const now = new Date();
        let start = new Date(now);
        let end: Date = new Date(now); // default end today
        if (timeframe === 'week') {
            start.setDate(now.getDate() - 6);
        } else if (timeframe === 'month') {
            start.setDate(1);
        } else if (timeframe === 'year') {
            start.setMonth(0, 1);
        } else if (timeframe === 'custom') {
            const s = new Date(customStart + 'T00:00:00');
            const e = new Date(customEnd + 'T23:59:59');
            if (!isNaN(s.getTime())) start.setTime(s.getTime());
            if (!isNaN(e.getTime())) end = e;
            // safety: if start after end swap
            if (start > end) { const tmp = new Date(start); start.setTime(end.getTime()); end = tmp; }
            // optional hard cap: limit to 370 days to protect performance
            const maxSpanDays = 370;
            const diffDays = (end.getTime() - start.getTime()) / 86400000;
            if (diffDays > maxSpanDays) {
                // trim start to maintain end
                const newStart = new Date(end); newStart.setDate(end.getDate() - maxSpanDays + 1); newStart.setHours(0, 0, 0, 0); start = newStart;
            }
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const dayMap: Record<string, Record<string, number>> = {};
        const stageSet = new Set<string>();
        for (const c of data) {
            const dStr = c.dateAdded?.slice(0, 10);
            if (!dStr || dStr.length < 10) continue;
            const d = new Date(dStr);
            if (isNaN(d.getTime()) || d < start || d > end) continue;
            const dayKey = d.toISOString().slice(0, 10);
            const st = stage(c);
            stageSet.add(st);
            if (!dayMap[dayKey]) dayMap[dayKey] = {};
            dayMap[dayKey][st] = (dayMap[dayKey][st] || 0) + 1;
        }
        // build ordered day list
        const days: string[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            days.push(d.toISOString().slice(0, 10));
        }
        const stageOrder = ['New', '1st Contact', '1st Status', '2nd Contact', 'Registered', 'Final Other'].filter(s => stageSet.has(s));
        const stacks = days.map(day => ({
            day,
            total: stageOrder.reduce((acc, st) => acc + (dayMap[day]?.[st] || 0), 0),
            segments: stageOrder.map(st => ({ stage: st, value: dayMap[day]?.[st] || 0 }))
        }));
        return { stacks, stageOrder };
    }, [data, timeframe, customStart, customEnd]);

    // Cumulative & rolling arrays (based on total counts per day)
    const cumulative = useMemo(() => {
        let run = 0; return stacks.map(s => { run += s.total; return run; });
    }, [stacks]);
    const rolling = useMemo(() => {
        const win = 7; // 7-day moving average
        return stacks.map((_, i) => {
            const slice = stacks.slice(Math.max(0, i - win + 1), i + 1);
            const sum = slice.reduce((a, b) => a + b.total, 0); return sum / slice.length;
        });
    }, [stacks]);

    // Headroom scaling for visual breathing space (count mode);
    const rawMaxTotal = Math.max(1, ...stacks.map(s => s.total));
    function computeScaleMax(v: number) {
        if (v <= 5) return v + 1; // small values just add 1
        const factor = v < 50 ? 0.15 : 0.10; // more headroom for smaller ranges
        const candidate = Math.ceil(v * (1 + factor));
        const roundBase = candidate <= 20 ? 2 : candidate <= 100 ? 5 : 10;
        return Math.ceil(candidate / roundBase) * roundBase;
    }
    const scaleMax = mode === 'count' ? computeScaleMax(rawMaxTotal) : 100;
    const barWidth = isFullscreen ? 34 : 24;
    const gap = isFullscreen ? 16 : 12;
    const chartWidth = stacks.length * (barWidth + gap) + 20;
    const chartHeight = isFullscreen ? 420 : 200;

    const stageColor: Record<string, string> = {
        'New': palette[0],
        '1st Contact': palette[1],
        '1st Status': palette[2],
        '2nd Contact': palette[3],
        'Registered': palette[4],
        'Final Other': palette[5],
    };

    // Insights
    const peak = useMemo(() => {
        if (stacks.length === 0) return null;
        return stacks.reduce((a, b) => b.total > a.total ? b : a, stacks[0]);
    }, [stacks]);
    const avgPerDay = useMemo(() => stacks.length ? (stacks.reduce((a, b) => a + b.total, 0) / stacks.length) : 0, [stacks]);
    const growth = useMemo(() => {
        if (stacks.length < 4) return null;
        const mid = Math.floor(stacks.length / 2);
        const first = stacks.slice(0, mid).reduce((a, b) => a + b.total, 0);
        const second = stacks.slice(mid).reduce((a, b) => a + b.total, 0);
        if (first === 0) return second > 0 ? 100 : 0;
        return ((second - first) / first) * 100;
    }, [stacks]);
    const topStage = useMemo<{ stage: string; value: number } | null>(() => {
        const acc: Record<string, number> = {};
        stacks.forEach(s => s.segments.forEach(seg => acc[seg.stage] = (acc[seg.stage] || 0) + seg.value));
        let top: { stage: string; value: number } | null = null;
        Object.entries(acc).forEach(([k, v]) => { if (!top || v > top.value) top = { stage: k, value: v }; });
        return top;
    }, [stacks]);

    return (
        <div className={isFullscreen ? 'fixed inset-0 z-50 bg-white p-6 overflow-auto max-h-screen flex flex-col shadow-xl' : ''} role={isFullscreen ? 'dialog' : undefined} aria-modal={isFullscreen || undefined}>
            <Panel title="Daily Progress">
                <div className="flex flex-wrap items-center gap-2 mb-6">
                    {(['week', 'month', 'year', 'custom'] as Timeframe[]).map(tf => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${timeframe === tf ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white/60 hover:bg-white border-gray-300 text-gray-700'}`}
                            aria-pressed={timeframe === tf}
                        >
                            {tf === 'week' ? 'This Week' : tf === 'month' ? 'This Month' : tf === 'year' ? 'This Year' : 'Custom'}
                        </button>
                    ))}
                    {timeframe === 'custom' && (
                        <div className="flex items-center gap-2 ml-2">
                            <input type="date" max={customEnd} value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white/70" />
                            <span className="text-[11px] text-gray-500">to</span>
                            <input type="date" min={customStart} value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white/70" />
                        </div>
                    )}
                    <span className="ml-2 inline-flex shadow-sm rounded-full overflow-hidden border border-gray-300">
                        <button onClick={() => setMode('count')} className={`px-3 py-1.5 text-[11px] font-semibold ${mode === 'count' ? 'bg-gray-900 text-white' : 'bg-white/70 text-gray-700 hover:bg-white'}`}>Count</button>
                        <button onClick={() => setMode('percent')} className={`px-3 py-1.5 text-[11px] font-semibold border-l border-gray-300 ${mode === 'percent' ? 'bg-gray-900 text-white' : 'bg-white/70 text-gray-700 hover:bg-white'}`}>%</button>
                    </span>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-gray-700 ml-2 cursor-pointer">
                        <input type="checkbox" checked={showCumulative} onChange={e => setShowCumulative(e.target.checked)} className="accent-blue-600" /> Cumulative
                    </label>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={showRolling} onChange={e => setShowRolling(e.target.checked)} className="accent-blue-600" /> 7d Avg
                    </label>
                    <button onClick={() => setShowInsights(i => !i)} className={`ml-auto px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${showInsights ? 'bg-gray-900 text-white border-gray-900' : 'bg-white/70 border-gray-300 hover:bg-white'} `}>{showInsights ? 'Hide' : 'Insights'}</button>
                    <button onClick={() => setIsFullscreen(f => !f)} className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${isFullscreen ? 'bg-gray-900 text-white border-gray-900' : 'bg-white/70 border-gray-300 hover:bg-white'}`}>{isFullscreen ? 'Exit Full' : 'Full View'}</button>
                </div>
                <div className="overflow-x-auto">
                    <svg width={chartWidth} height={chartHeight + 60} role="img" aria-label={`Daily stacked bar chart for ${timeframe} (${mode})`}>
                        {/* Y axis grid lines */}
                        {Array.from({ length: 5 }).map((_, i) => {
                            const y = (chartHeight / 4) * i;
                            const raw = scaleMax - (scaleMax / 4) * i;
                            const val = mode === 'percent' ? Math.round(raw) + '%' : Math.round(raw);
                            return (
                                <g key={i}>
                                    <line x1={0} x2={chartWidth} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="2 4" />
                                    <text x={0} y={y + 10} fontSize={10} fill="#6b7280">{val}</text>
                                </g>
                            );
                        })}
                        {stacks.map((s, idx) => {
                            const x = 40 + idx * (barWidth + gap);
                            let yOffset = chartHeight;
                            return (
                                <g key={s.day}>
                                    {s.segments.map(seg => {
                                        if (mode === 'count') {
                                            if (!seg.value) return null;
                                            const h = (seg.value / scaleMax) * chartHeight;
                                            yOffset -= h;
                                            return <rect key={seg.stage} x={x} y={yOffset} width={barWidth} height={h} fill={stageColor[seg.stage]} rx={2} />;
                                        } else { // percent mode
                                            const dayTotal = s.total || 1;
                                            const pct = (seg.value / dayTotal) * 100;
                                            if (pct === 0) return null;
                                            const h = (pct / 100) * chartHeight;
                                            yOffset -= h;
                                            return <rect key={seg.stage} x={x} y={yOffset} width={barWidth} height={h} fill={stageColor[seg.stage]} rx={2} />;
                                        }
                                    })}
                                    {/* Day label */}
                                    <text x={x + barWidth / 2} y={chartHeight + 18} fontSize={9} textAnchor="middle" fill="#374151">{s.day.slice(5)}</text>
                                    {mode === 'count' && s.total > 0 && <text x={x + barWidth / 2} y={yOffset - 4} fontSize={9} textAnchor="middle" fill="#111827" fontWeight={600}>{s.total}</text>}
                                </g>
                            );
                        })}
                        {/* Cumulative line (counts only) */}
                        {showCumulative && mode === 'count' && cumulative.length > 0 && (() => {
                            const maxCum = cumulative[cumulative.length - 1];
                            const scaleY = (v: number) => chartHeight - (v / maxCum) * chartHeight;
                            const d = cumulative.map((v, i) => {
                                const x = 40 + i * (barWidth + gap) + barWidth / 2;
                                const y = scaleY(v);
                                return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                            }).join(' ');
                            return <path d={d} fill="none" stroke="#111827" strokeWidth={2} strokeLinecap="round" />;
                        })()}
                        {/* Rolling average line (count mode) */}
                        {showRolling && mode === 'count' && rolling.length > 0 && (() => {
                            const maxLine = Math.max(...rolling, 1);
                            const scaleY = (v: number) => chartHeight - (v / maxLine) * chartHeight;
                            const d = rolling.map((v, i) => {
                                const x = 40 + i * (barWidth + gap) + barWidth / 2;
                                const y = scaleY(v);
                                return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                            }).join(' ');
                            return <path d={d} fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />;
                        })()}
                        {showCumulative && mode === 'count' && cumulative.length > 0 && (
                            <text x={chartWidth - 10} y={16} fontSize={10} textAnchor="end" fill="#111827" className="font-semibold">Cumulative</text>
                        )}
                        {showRolling && mode === 'count' && rolling.length > 0 && (
                            <text x={chartWidth - 10} y={30} fontSize={10} textAnchor="end" fill="#6366f1">7d Avg</text>
                        )}
                    </svg>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                    {stageOrder.map(st => (
                        <div key={st} className="flex items-center gap-2 text-[11px] font-medium text-gray-700 bg-white/70 border border-gray-200 rounded-full pl-2 pr-3 py-1 shadow-sm">
                            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: stageColor[st] }} />{st}
                        </div>
                    ))}
                    {stageOrder.length === 0 && <span className="text-xs text-gray-400 italic">No activity in timeframe</span>}
                </div>
                {showInsights && (
                    <div className="mt-6 grid sm:grid-cols-2 gap-4 text-[11px] text-gray-700">
                        <InsightCard label="Peak Day" value={peak ? peak.day.slice(5) : '—'} detail={peak ? peak.total + ' leads' : ''} />
                        <InsightCard label="Avg / Day" value={avgPerDay.toFixed(1)} detail={timeframe === 'week' ? 'Current window' : timeframe === 'month' ? 'This month' : 'This year slice'} />
                        <InsightCard label="Top Stage" value={topStage ? topStage.stage : '—'} detail={topStage ? topStage.value + ' leads' : ''} />
                        <InsightCard label="Growth" value={growth == null ? '—' : (growth > 0 ? '+' : '') + growth.toFixed(1) + '%'} detail="2nd half vs 1st" />
                    </div>
                )}
            </Panel>
        </div>
    );
}

// --- Monthly Progress Panel ---

function MonthlyProgressPanel({ data }: { data: Customer[] }) {
    const [range, setRange] = useState<'ytd' | '12m' | '24m' | 'custom'>('ytd');
    const [mode, setMode] = useState<'count' | 'percent'>('count');
    const [showCumulative, setShowCumulative] = useState(true);
    const [showRolling, setShowRolling] = useState(false); // 3-month avg
    const [showInsights, setShowInsights] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const prevOverflowRef = useRef<string | null>(null);
    const enterScrollPosRef = useRef<number>(0);
    useEffect(() => {
        function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') setIsFullscreen(false); }
        if (isFullscreen) {
            enterScrollPosRef.current = window.scrollY;
            prevOverflowRef.current = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
            window.addEventListener('keydown', handleKey);
        } else {
            window.removeEventListener('keydown', handleKey);
            if (prevOverflowRef.current !== null) {
                document.body.style.overflow = prevOverflowRef.current;
                prevOverflowRef.current = null;
            } else {
                document.body.style.overflow = '';
            }
            if (enterScrollPosRef.current > 0) {
                window.requestAnimationFrame(() => window.scrollTo({ top: enterScrollPosRef.current, behavior: 'smooth' }));
            }
        }
        return () => {
            window.removeEventListener('keydown', handleKey);
            if (prevOverflowRef.current !== null) {
                document.body.style.overflow = prevOverflowRef.current;
                prevOverflowRef.current = null;
            } else {
                document.body.style.overflow = '';
            }
        };
    }, [isFullscreen]);
    const [customMonthStart, setCustomMonthStart] = useState<string>(() => {
        const d = new Date(); d.setMonth(d.getMonth() - 11); return d.toISOString().slice(0, 7); // last 12 months
    });
    const [customMonthEnd, setCustomMonthEnd] = useState<string>(() => new Date().toISOString().slice(0, 7));

    const { stacks, stageOrder } = useMemo(() => {
        function stage(c: Customer): string {
            if (c.finalStatus === 'Registered') return 'Registered';
            if (c.finalStatus === 'Follow-up Needed' || c.finalStatus === 'Not Registered') return 'Final Other';
            if (c.secondCallDate || c.secondCallStatus) return '2nd Contact';
            if (c.firstCallStatus) return '1st Status';
            if (c.firstCallDate) return '1st Contact';
            return 'New';
        }
        const now = new Date();
        let end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // default end of current month
        let start: Date;
        if (range === 'ytd') start = new Date(now.getFullYear(), 0, 1);
        else if (range === '12m') start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        else if (range === '24m') start = new Date(now.getFullYear(), now.getMonth() - 23, 1);
        else { // custom
            const sParts = customMonthStart.split('-');
            const eParts = customMonthEnd.split('-');
            const sYear = parseInt(sParts[0] || ''); const sMonth = parseInt(sParts[1] || '') - 1;
            const eYear = parseInt(eParts[0] || ''); const eMonth = parseInt(eParts[1] || '') - 1;
            start = new Date(sYear, isNaN(sMonth) ? 0 : sMonth, 1);
            end = new Date(eYear, isNaN(eMonth) ? 0 : eMonth + 1, 0);
            // swap if reversed
            if (start > end) { const tmp = new Date(start); start = new Date(end); end = tmp; }
            // limit to 36 months for performance
            const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
            if (diffMonths > 36) {
                start = new Date(end.getFullYear(), end.getMonth() - 35, 1);
            }
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        // Build month list
        const months: { key: string; label: string; map: Record<string, number> }[] = [];
        const cur = new Date(start);
        while (cur <= end) {
            const key = cur.toISOString().slice(0, 7); // YYYY-MM
            months.push({ key, label: cur.toLocaleString(undefined, { month: 'short' }), map: {} });
            cur.setMonth(cur.getMonth() + 1);
        }
        const monthIndex: Record<string, number> = {};
        months.forEach((m, i) => monthIndex[m.key] = i);
        const stageSet = new Set<string>();
        data.forEach(c => {
            const da = c.dateAdded?.slice(0, 10);
            if (!da) return; const key = da.slice(0, 7); if (!(key in monthIndex)) return;
            const st = stage(c); stageSet.add(st);
            const m = months[monthIndex[key]]; m.map[st] = (m.map[st] || 0) + 1;
        });
        const stageOrder = ['New', '1st Contact', '1st Status', '2nd Contact', 'Registered', 'Final Other'].filter(s => stageSet.has(s));
        const stacks = months.map(m => ({
            month: m.key,
            label: m.label,
            total: stageOrder.reduce((a, st) => a + (m.map[st] || 0), 0),
            segments: stageOrder.map(st => ({ stage: st, value: m.map[st] || 0 }))
        }));
        return { stacks, stageOrder };
    }, [data, range, customMonthStart, customMonthEnd]);

    const cumulative = useMemo(() => { let run = 0; return stacks.map(s => { run += s.total; return run; }); }, [stacks]);
    const rolling = useMemo(() => {
        const win = 3; return stacks.map((_, i) => {
            const slice = stacks.slice(Math.max(0, i - win + 1), i + 1);
            const sum = slice.reduce((a, b) => a + b.total, 0); return sum / slice.length;
        });
    }, [stacks]);
    // Headroom scaling (matches Daily logic) for better visual breathing space
    const rawMaxTotal = Math.max(1, ...stacks.map(s => s.total));
    function computeScaleMax(v: number) {
        if (v <= 5) return v + 1;
        const factor = v < 50 ? 0.15 : 0.10; // more headroom for smaller totals
        const candidate = Math.ceil(v * (1 + factor));
        const roundBase = candidate <= 20 ? 2 : candidate <= 100 ? 5 : 10;
        return Math.ceil(candidate / roundBase) * roundBase;
    }
    const scaleMax = mode === 'count' ? computeScaleMax(rawMaxTotal) : 100;
    const barWidth = isFullscreen ? 46 : 34; const gap = isFullscreen ? 18 : 14; const chartHeight = isFullscreen ? 460 : 220;
    const chartWidth = stacks.length * (barWidth + gap) + 80;
    const stageColor: Record<string, string> = {
        'New': palette[0],
        '1st Contact': palette[1],
        '1st Status': palette[2],
        '2nd Contact': palette[3],
        'Registered': palette[4],
        'Final Other': palette[5],
    };

    // Insights
    const peak = useMemo(() => stacks.length ? stacks.reduce((a, b) => b.total > a.total ? b : a, stacks[0]) : null, [stacks]);
    const avgPerMonth = useMemo(() => stacks.length ? stacks.reduce((a, b) => a + b.total, 0) / stacks.length : 0, [stacks]);
    const growth = useMemo(() => {
        if (stacks.length < 4) return null; const mid = Math.floor(stacks.length / 2);
        const first = stacks.slice(0, mid).reduce((a, b) => a + b.total, 0); const second = stacks.slice(mid).reduce((a, b) => a + b.total, 0);
        if (first === 0) return second > 0 ? 100 : 0; return ((second - first) / first) * 100;
    }, [stacks]);
    const topStage = useMemo<{ stage: string; value: number } | null>(() => {
        const acc: Record<string, number> = {}; stacks.forEach(s => s.segments.forEach(seg => acc[seg.stage] = (acc[seg.stage] || 0) + seg.value));
        let top: { stage: string; value: number } | null = null; Object.entries(acc).forEach(([k, v]) => { if (!top || v > top.value) top = { stage: k, value: v }; }); return top;
    }, [stacks]);

    return (
        <div className={isFullscreen ? 'fixed inset-0 z-50 bg-white p-6 overflow-auto max-h-screen flex flex-col shadow-xl' : ''} role={isFullscreen ? 'dialog' : undefined} aria-modal={isFullscreen || undefined}>
            <Panel title="Monthly Progress">
                <div className="flex flex-wrap items-center gap-2 mb-6">
                    {(['ytd', '12m', '24m', 'custom'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${range === r ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white/60 hover:bg-white border-gray-300 text-gray-700'}`}
                        >
                            {r === 'ytd' ? 'YTD' : r === '12m' ? '12M' : r === '24m' ? '24M' : 'Custom'}
                        </button>
                    ))}
                    {range === 'custom' && (
                        <div className="flex items-center gap-2 ml-2">
                            <input type="month" max={customMonthEnd} value={customMonthStart} onChange={e => setCustomMonthStart(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white/70" />
                            <span className="text-[11px] text-gray-500">to</span>
                            <input type="month" min={customMonthStart} value={customMonthEnd} onChange={e => setCustomMonthEnd(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white/70" />
                        </div>
                    )}
                    <span className="ml-2 inline-flex shadow-sm rounded-full overflow-hidden border border-gray-300">
                        <button onClick={() => setMode('count')} className={`px-3 py-1.5 text-[11px] font-semibold ${mode === 'count' ? 'bg-gray-900 text-white' : 'bg-white/70 text-gray-700 hover:bg-white'}`}>Count</button>
                        <button onClick={() => setMode('percent')} className={`px-3 py-1.5 text-[11px] font-semibold border-l border-gray-300 ${mode === 'percent' ? 'bg-gray-900 text-white' : 'bg-white/70 text-gray-700 hover:bg-white'}`}>%</button>
                    </span>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-gray-700 ml-2 cursor-pointer"><input type="checkbox" checked={showCumulative} onChange={e => setShowCumulative(e.target.checked)} className="accent-blue-600" /> Cumulative</label>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-gray-700 cursor-pointer"><input type="checkbox" checked={showRolling} onChange={e => setShowRolling(e.target.checked)} className="accent-blue-600" /> 3m Avg</label>
                    <button onClick={() => setShowInsights(i => !i)} className={`ml-auto px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${showInsights ? 'bg-gray-900 text-white border-gray-900' : 'bg-white/70 border-gray-300 hover:bg-white'} `}>{showInsights ? 'Hide' : 'Insights'}</button>
                    <button onClick={() => setIsFullscreen(f => !f)} className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${isFullscreen ? 'bg-gray-900 text-white border-gray-900' : 'bg-white/70 border-gray-300 hover:bg-white'}`}>{isFullscreen ? 'Exit Full' : 'Full View'}</button>
                </div>
                <div className="overflow-x-auto">
                    <svg width={chartWidth} height={chartHeight + 60} role="img" aria-label={`Monthly stacked bar chart (${range})`}>
                        {Array.from({ length: 5 }).map((_, i) => {
                            const y = (chartHeight / 4) * i; const raw = scaleMax - (scaleMax / 4) * i; const val = mode === 'percent' ? Math.round(raw) + '%' : Math.round(raw);
                            return <g key={i}><line x1={0} x2={chartWidth} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="2 4" /><text x={0} y={y + 10} fontSize={10} fill="#6b7280">{val}</text></g>;
                        })}
                        {stacks.map((s, idx) => {
                            const x = 60 + idx * (barWidth + gap);
                            let yOffset = chartHeight;
                            return <g key={s.month}>
                                {s.segments.map(seg => {
                                    if (mode === 'count') {
                                        if (!seg.value) return null; const h = (seg.value / scaleMax) * chartHeight; yOffset -= h; return <rect key={seg.stage} x={x} y={yOffset} width={barWidth} height={h} fill={stageColor[seg.stage]} rx={2} />;
                                    } else {
                                        const dayTotal = s.total || 1; const pct = (seg.value / dayTotal) * 100; if (pct === 0) return null; const h = (pct / 100) * chartHeight; yOffset -= h; return <rect key={seg.stage} x={x} y={yOffset} width={barWidth} height={h} fill={stageColor[seg.stage]} rx={2} />;
                                    }
                                })}
                                <text x={x + barWidth / 2} y={chartHeight + 18} fontSize={10} textAnchor="middle" fill="#374151">{s.label}</text>
                                {mode === 'count' && s.total > 0 && <text x={x + barWidth / 2} y={yOffset - 4} fontSize={9} textAnchor="middle" fill="#111827" fontWeight={600}>{s.total}</text>}
                            </g>;
                        })}
                        {showCumulative && mode === 'count' && cumulative.length > 0 && (() => { const maxCum = cumulative[cumulative.length - 1]; const scaleY = (v: number) => chartHeight - (v / maxCum) * chartHeight; const d = cumulative.map((v, i) => { const x = 60 + i * (barWidth + gap) + barWidth / 2; const y = scaleY(v); return `${i === 0 ? 'M' : 'L'}${x},${y}`; }).join(' '); return <path d={d} fill="none" stroke="#111827" strokeWidth={2} strokeLinecap="round" />; })()}
                        {showRolling && mode === 'count' && rolling.length > 0 && (() => { const maxLine = Math.max(...rolling, 1); const scaleY = (v: number) => chartHeight - (v / maxLine) * chartHeight; const d = rolling.map((v, i) => { const x = 60 + i * (barWidth + gap) + barWidth / 2; const y = scaleY(v); return `${i === 0 ? 'M' : 'L'}${x},${y}`; }).join(' '); return <path d={d} fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />; })()}
                        {showCumulative && mode === 'count' && cumulative.length > 0 && <text x={chartWidth - 10} y={16} fontSize={10} textAnchor="end" fill="#111827" className="font-semibold">Cumulative</text>}
                        {showRolling && mode === 'count' && rolling.length > 0 && <text x={chartWidth - 10} y={30} fontSize={10} textAnchor="end" fill="#6366f1">3m Avg</text>}
                    </svg>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                    {stageOrder.map(st => (
                        <div key={st} className="flex items-center gap-2 text-[11px] font-medium text-gray-700 bg-white/70 border border-gray-200 rounded-full pl-2 pr-3 py-1 shadow-sm">
                            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: stageColor[st] }} />{st}
                        </div>
                    ))}
                    {stageOrder.length === 0 && <span className="text-xs text-gray-400 italic">No activity</span>}
                </div>
                {showInsights && (
                    <div className="mt-6 grid sm:grid-cols-2 gap-4 text-[11px] text-gray-700">
                        <InsightCard label="Peak Month" value={peak ? peak.label : '—'} detail={peak ? peak.total + ' leads' : ''} />
                        <InsightCard label="Avg / Month" value={avgPerMonth.toFixed(1)} detail={range.toUpperCase()} />
                        <InsightCard label="Top Stage" value={topStage ? topStage.stage : '—'} detail={topStage ? topStage.value + ' leads' : ''} />
                        <InsightCard label="Growth" value={growth == null ? '—' : (growth > 0 ? '+' : '') + growth.toFixed(1) + '%'} detail="2nd half vs 1st" />
                    </div>
                )}
            </Panel>
        </div>
    );
}

function InsightCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white/60 p-3 flex flex-col gap-1 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
            <div className="text-sm font-bold text-gray-900">{value}</div>
            {detail && <div className="text-[10px] text-gray-500">{detail}</div>}
        </div>
    );
}

// (Removed previous PeriodProgressPanel now superseded by MonthlyProgressPanel)

// --- Funnel Conversion Panel ---

function FunnelPanel({ data }: { data: Customer[] }) {
    const funnel = useMemo(() => {
        const total = data.length || 1;
        const firstContact = data.filter(c => c.firstCallDate).length;
        const firstStatus = data.filter(c => c.firstCallStatus).length;
        const secondContact = data.filter(c => c.secondCallDate || c.secondCallStatus).length;
        const registered = data.filter(c => c.finalStatus === 'Registered').length;
        const finalOther = data.filter(c => c.finalStatus === 'Follow-up Needed' || c.finalStatus === 'Not Registered').length;
        const steps = [
            { label: 'Total', value: total },
            { label: '1st Contact', value: firstContact },
            { label: '1st Status', value: firstStatus },
            { label: '2nd Contact', value: secondContact },
            { label: 'Registered', value: registered },
            { label: 'Final Other', value: finalOther },
        ];
        return { steps, total };
    }, [data]);
    const max = funnel.steps[0].value || 1;
    return (
        <Panel title="Funnel Conversion">
            <div className="space-y-3">
                {funnel.steps.map((s, i) => {
                    const pct = (s.value / max) * 100;
                    const conv = ((s.value / max) * 100).toFixed(1);
                    return (
                        <div key={s.label} className="flex items-center gap-3">
                            <div className="w-28 text-[11px] font-semibold text-gray-700">{s.label}</div>
                            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: pct + '%', background: `linear-gradient(90deg, ${palette[i % palette.length]}, ${palette[(i + 1) % palette.length]}` }} />
                            </div>
                            <div className="w-14 text-right text-[11px] font-medium text-gray-800 tabular-nums">{s.value}</div>
                            <div className="w-12 text-right text-[11px] text-gray-500">{conv}%</div>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

// --- Source Conversion Panel ---

function SourceConversionPanel({ data }: { data: Customer[] }) {
    const rows = useMemo(() => {
        return SOURCE_OPTIONS.map(src => {
            const leads = data.filter(c => c.source === src);
            const total = leads.length;
            const registered = leads.filter(c => c.finalStatus === 'Registered').length;
            return { src, total, registered, rate: total ? (registered / total) * 100 : 0 };
        }).filter(r => r.total > 0);
    }, [data]);
    const maxRate = Math.max(1, ...rows.map(r => r.rate));
    return (
        <Panel title="Source Performance (Conversion)">
            <div className="space-y-3">
                {rows.map((r, i) => {
                    const w = (r.rate / maxRate) * 100;
                    return (
                        <div key={r.src} className="flex items-center gap-3">
                            <div className="w-24 text-[11px] font-semibold text-gray-700">{r.src}</div>
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: w + '%', backgroundColor: palette[i % palette.length] }} />
                            </div>
                            <div className="w-16 text-right text-[11px] text-gray-700 tabular-nums">{r.registered}/{r.total}</div>
                            <div className="w-12 text-right text-[11px] font-semibold text-gray-900">{r.rate.toFixed(1)}%</div>
                        </div>
                    );
                })}
                {rows.length === 0 && <div className="text-xs text-gray-400 italic">No source data</div>}
            </div>
        </Panel>
    );
}

// --- Stage Velocity Panel ---

function StageVelocityPanel({ data }: { data: Customer[] }) {
    interface Summary { n: number; p50: number | null; p75: number | null; p90: number | null; avg: number | null; }
    interface VelocityStats { added_first: Summary; first_second: Summary; second_final: Summary; added_final: Summary; }
    const stats: VelocityStats = useMemo(() => {
        function parseDate(s: string | undefined) {
            if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d;
        }
        function diffDays(a: Date | null, b: Date | null) { if (!a || !b) return null; return (b.getTime() - a.getTime()) / 86400000; }
        const arr1: number[] = []; // added -> first
        const arr2: number[] = []; // first -> second
        const arr3: number[] = []; // second -> final
        const arrTotal: number[] = []; // added -> final
        for (const c of data) {
            const dAdded = parseDate(c.dateAdded);
            const d1 = parseDate(c.firstCallDate);
            const d2 = parseDate(c.secondCallDate);
            const dF = parseDate(c.finalCallDate);
            const d1d = diffDays(dAdded, d1); if (d1d != null && d1d >= 0 && d1d < 365) arr1.push(d1d);
            const d2d = diffDays(d1, d2); if (d2d != null && d2d >= 0 && d2d < 365) arr2.push(d2d);
            const d3d = diffDays(d2, dF); if (d3d != null && d3d >= 0 && d3d < 365) arr3.push(d3d);
            const dTd = diffDays(dAdded, dF); if (dTd != null && dTd >= 0 && dTd < 365) arrTotal.push(dTd);
        }
        function summarize(nums: number[]) {
            if (nums.length === 0) return { n: 0, p50: null, p75: null, p90: null, avg: null };
            const sorted = [...nums].sort((a, b) => a - b);
            const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
            const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
            return { n: sorted.length, p50: q(0.5), p75: q(0.75), p90: q(0.9), avg };
        }
        return {
            added_first: summarize(arr1),
            first_second: summarize(arr2),
            second_final: summarize(arr3),
            added_final: summarize(arrTotal)
        };
    }, [data]);
    const rows = [
        { label: 'Added → 1st Contact', k: 'added_first' },
        { label: '1st → 2nd Contact', k: 'first_second' },
        { label: '2nd → Final', k: 'second_final' },
        { label: 'Added → Final', k: 'added_final' },
    ] as const;
    return (
        <Panel title="Stage Velocity (Days)">
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-gray-500 text-left">
                            <th className="py-2 pr-4 font-semibold">Transition</th>
                            <th className="py-2 pr-4 font-semibold">Count</th>
                            <th className="py-2 pr-4 font-semibold">Median</th>
                            <th className="py-2 pr-4 font-semibold">P75</th>
                            <th className="py-2 pr-4 font-semibold">P90</th>
                            <th className="py-2 pr-4 font-semibold">Avg</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/70">
                        {rows.map(r => {
                            const s = stats[r.k as keyof VelocityStats];
                            const cell = (v: number | null) => v == null ? '—' : v.toFixed(1);
                            return (
                                <tr key={r.k} className="hover:bg-gray-50">
                                    <td className="py-2 pr-4 font-medium text-gray-700">{r.label}</td>
                                    <td className="py-2 pr-4 text-gray-900 font-semibold tabular-nums">{s.n}</td>
                                    <td className="py-2 pr-4 tabular-nums">{cell(s.p50)}</td>
                                    <td className="py-2 pr-4 tabular-nums">{cell(s.p75)}</td>
                                    <td className="py-2 pr-4 tabular-nums">{cell(s.p90)}</td>
                                    <td className="py-2 pr-4 tabular-nums">{cell(s.avg)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
}
