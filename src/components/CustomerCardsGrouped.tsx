"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Customer, SECOND_CALL_STATUS_OPTIONS, FIRST_CALL_STATUS_OPTIONS, FINAL_STATUS_OPTIONS, SOURCE_OPTIONS } from "@/types/customer";
import { useTheme } from '@/hooks/useTheme';
import { computeLeadNumbers } from '@/utils/leads';
import { deriveBadgePalette } from '@/utils/color';
import CustomerProgressBar from "./CustomerProgressBar";

function formatYMD(dateStr?: string) {
    if (!dateStr) return "Unknown";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Unknown";
    return d.toISOString().slice(0, 10);
}

function prettyDate(ymd: string) {
    if (ymd === "Unknown") return "Unknown";
    const d = new Date(ymd);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

type Props = {
    data: Customer[];
    onUpdateCustomer: (id: string, updates: Partial<Customer>) => void;
    selectionMode?: boolean;
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
    leadNumbers?: Record<string, number>;
};

export default function CustomerCardsGrouped({ data, onUpdateCustomer, selectionMode = false, selectedIds, onToggleSelect, leadNumbers: externalLeadNumbers }: Props) {
    const [selectedDate, setSelectedDate] = useState<string>("");
    const containerRef = useRef<HTMLDivElement | null>(null);
    const { customStatusColors } = useTheme();
    // Compute unified lead numbering based on earliest chronological date
    const internalLeadNumbers = useMemo(() => computeLeadNumbers(data), [data]);
    const leadNumbers = externalLeadNumbers || internalLeadNumbers;

    const groups = useMemo(() => {
        const map = new Map<string, Customer[]>();
        for (const c of data) {
            const key = formatYMD(c.dateAdded || "");
            const arr = map.get(key) || [];
            arr.push(c);
            map.set(key, arr);
        }
        const entries = Array.from(map.entries());
        entries.sort((a, b) => (a[0] < b[0] ? 1 : -1)); // newest first
        return entries;
    }, [data]);

    const dateKeys = useMemo(() => groups.map(([k]) => k), [groups]);

    useEffect(() => {
        if (!selectedDate && dateKeys.length > 0) setSelectedDate(dateKeys[0]);
    }, [dateKeys, selectedDate]);

    useEffect(() => {
        if (!selectedDate) return;
        const el = document.getElementById(`group-${selectedDate}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [selectedDate]);

    return (
        <div className="space-y-8" ref={containerRef}>
            <div className="space-y-14">
                {groups.map(([k, customers]) => {
                    const allSelected = selectionMode && customers.every(c => selectedIds?.has(c.id));
                    const someSelected = selectionMode && !allSelected && customers.some(c => selectedIds?.has(c.id));
                    const toggleGroup = () => {
                        if (!onToggleSelect) return;
                        if (allSelected) {
                            customers.forEach(c => onToggleSelect(c.id)); // will unselect each
                        } else {
                            customers.forEach(c => { if (!selectedIds?.has(c.id)) onToggleSelect(c.id); });
                        }
                    };
                    return (
                        <section key={k} id={`group-${k}`} className="scroll-mt-24">
                            <div className="sticky top-16 z-10 -mx-2 px-2 py-2">
                                <div className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 shadow-sm">
                                    {selectionMode && (
                                        <button type="button" onClick={toggleGroup} className={`h-4 w-4 rounded border flex items-center justify-center text-[10px] font-bold ${allSelected ? 'bg-white text-blue-600' : someSelected ? 'bg-white/60 text-blue-900' : 'bg-white/20 text-white'}`}>{allSelected ? '✓' : someSelected ? '−' : '+'}</button>
                                    )}
                                    <span className="text-sm font-semibold">{prettyDate(k)}</span>
                                    <span className="text-xs font-medium bg-white/20 rounded-full px-2 py-0.5">{customers.length} {customers.length === 1 ? 'Lead' : 'Leads'}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-4">
                                {customers.map(c => (
                                    <GroupedCustomerCard
                                        key={c.id}
                                        c={c}
                                        leadNumber={leadNumbers[c.id]}
                                        customStatusColors={customStatusColors}
                                        groupDate={k}
                                        onUpdateCustomer={onUpdateCustomer}
                                        selectionMode={selectionMode}
                                        selected={!!selectedIds?.has(c.id)}
                                        onToggleSelect={onToggleSelect}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}

function GroupedCustomerCard({ c, /* leadNumber */ customStatusColors, groupDate, onUpdateCustomer, selectionMode, selected, onToggleSelect }: { c: Customer; leadNumber?: number; customStatusColors: Record<string, string>; groupDate: string; onUpdateCustomer: (id: string, updates: Partial<Customer>) => void; selectionMode?: boolean; selected?: boolean; onToggleSelect?: (id: string) => void }) {
    const [editing, setEditing] = useState<keyof Customer | null>(null);
    const [draft, setDraft] = useState<string>('');

    const start = (field: keyof Customer) => {
        setEditing(field);
        setDraft((c[field] ?? '') as string);
    };
    const save = () => {
        if (!editing) return;
        onUpdateCustomer(c.id, { [editing]: draft });
        setEditing(null);
    };
    const cancel = () => setEditing(null);

    const render = (field: keyof Customer, placeholder: string, isSelectSource = false) => {
        const value = c[field] as string | undefined;
        if (editing === field) {
            return (
                <div className="flex items-center gap-1">
                    {isSelectSource ? (
                        <select autoFocus className="px-1 py-0.5 border rounded text-[10px]" value={draft} onChange={e => setDraft(e.target.value)}>
                            <option value="">--</option>
                            {SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : (
                        <input autoFocus className="px-1 py-0.5 border rounded text-[10px]" value={draft} onChange={e => setDraft(e.target.value)} />
                    )}
                    <button onClick={save} className="text-green-600 text-[10px] font-semibold">Save</button>
                    <button onClick={cancel} className="text-red-500 text-[10px] font-semibold">X</button>
                </div>
            );
        }
        return <span onClick={() => start(field)} className="cursor-pointer hover:underline">{value || placeholder}</span>;
    };

    const firstClr = c.firstCallStatus && customStatusColors[c.firstCallStatus] ? deriveBadgePalette(customStatusColors[c.firstCallStatus]) : null;
    const secondClr = c.secondCallStatus && customStatusColors[c.secondCallStatus] ? deriveBadgePalette(customStatusColors[c.secondCallStatus]) : null;
    const finalClr = c.finalStatus && customStatusColors[c.finalStatus] ? deriveBadgePalette(customStatusColors[c.finalStatus]) : null;
    return (
        <article className={`relative bg-white/80 backdrop-blur rounded-2xl border shadow-sm hover:shadow-md transition p-5 flex flex-col ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}>
            {selectionMode && (
                <div className="absolute -top-2 -left-2 bg-white rounded-full shadow p-1">
                    <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer"
                        checked={selected}
                        onChange={() => onToggleSelect && onToggleSelect(c.id)}
                    />
                </div>
            )}
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-900">{render('name', 'Unnamed')}</div>
                    <div className="text-xs text-gray-500">{render('phone', 'No phone')}</div>
                    {c.email && <div className="text-[10px] text-gray-400 break-all">{render('email', 'Email')}</div>}
                    <div className="text-[10px] uppercase tracking-wide font-medium text-gray-400">{render('source', 'Unknown', true)}</div>
                </div>
                <div className="text-[10px] text-gray-500">Added {prettyDate(groupDate)}</div>
            </div>
            <div className="mt-3">
                <CustomerProgressBar customer={c} />
            </div>
            <div className="mt-4 space-y-3 text-xs">
                <Field label="First Call Date">
                    <input
                        type="date"
                        className="w-full border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        value={c.firstCallDate || ""}
                        onChange={(e) => onUpdateCustomer(c.id, { firstCallDate: e.target.value })}
                    />
                </Field>
                <Field label="First Call Status">
                    <select
                        className="w-full border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white"
                        value={c.firstCallStatus || ""}
                        onChange={(e) => {
                            const val = e.target.value as Customer['firstCallStatus'];
                            if (!val) {
                                onUpdateCustomer(c.id, {
                                    firstCallStatus: '' as Customer['firstCallStatus'],
                                    firstCallDate: '',
                                    secondCallStatus: '' as Customer['secondCallStatus'],
                                    secondCallDate: '',
                                    finalStatus: '' as Customer['finalStatus'],
                                    finalCallDate: ''
                                });
                            } else {
                                onUpdateCustomer(c.id, { firstCallStatus: val });
                            }
                        }}
                    >
                        <option value="">--</option>
                        {FIRST_CALL_STATUS_OPTIONS.map(o => (
                            <option key={o} value={o}>{o}</option>
                        ))}
                    </select>
                    {c.firstCallStatus && firstClr && <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: firstClr.bg, border: `1px solid ${firstClr.border}`, color: firstClr.text }}>{c.firstCallStatus}</span>}
                </Field>
                <Field label="Second Contact">
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="date"
                            className="border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            value={c.secondCallDate || ""}
                            onChange={(e) => onUpdateCustomer(c.id, { secondCallDate: e.target.value })}
                        />
                        <select
                            className="border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white"
                            value={c.secondCallStatus || ""}
                            onChange={(e) => {
                                const val = e.target.value as Customer['secondCallStatus'];
                                if (!val) {
                                    onUpdateCustomer(c.id, {
                                        secondCallStatus: '' as Customer['secondCallStatus'],
                                        secondCallDate: '',
                                        finalStatus: '' as Customer['finalStatus'],
                                        finalCallDate: ''
                                    });
                                } else {
                                    onUpdateCustomer(c.id, { secondCallStatus: val });
                                }
                            }}
                        >
                            <option value="">--</option>
                            {SECOND_CALL_STATUS_OPTIONS.map(o => (
                                <option key={o} value={o}>{o}</option>
                            ))}
                        </select>
                    </div>
                    {c.secondCallStatus && secondClr && <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: secondClr.bg, border: `1px solid ${secondClr.border}`, color: secondClr.text }}>{c.secondCallStatus}</span>}
                </Field>
                <Field label="Final Status">
                    <select
                        className="w-full border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white"
                        value={c.finalStatus || ""}
                        onChange={(e) => onUpdateCustomer(c.id, { finalStatus: e.target.value as Customer['finalStatus'] })}
                    >
                        <option value="">--</option>
                        {FINAL_STATUS_OPTIONS.map(o => (
                            <option key={o} value={o}>{o}</option>
                        ))}
                    </select>
                    {c.finalStatus && finalClr && <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: finalClr.bg, border: `1px solid ${finalClr.border}`, color: finalClr.text }}>{c.finalStatus}</span>}
                </Field>
                <Field label="Notes">
                    <textarea
                        className="w-full border rounded-md px-2 py-1 text-xs min-h-[60px] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        value={c.notes || ""}
                        onChange={(e) => onUpdateCustomer(c.id, { notes: e.target.value })}
                    />
                </Field>
            </div>
        </article>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
            {children}
        </label>
    );
}
