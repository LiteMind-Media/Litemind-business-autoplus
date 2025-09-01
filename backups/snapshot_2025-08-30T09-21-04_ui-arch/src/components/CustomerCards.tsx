"use client";

import { Customer, FIRST_CALL_STATUS_OPTIONS, SECOND_CALL_STATUS_OPTIONS, FINAL_STATUS_OPTIONS, SOURCE_OPTIONS } from "@/types/customer";
import { useTheme } from '@/hooks/useTheme';
import { deriveBadgePalette } from '@/utils/color';
import { computeLeadNumbers } from '@/utils/leads';
import CustomerProgressBar from "./CustomerProgressBar";
import { Phone, User, CalendarDays, CheckCircle2, Clock3, FileText, Save, X, Edit3, Layers } from "lucide-react";
import Badge from "./Badge";
import { Input, Select, TextArea } from './UI';
import { useState } from 'react';

type Props = {
    data: Customer[];
    onUpdateCustomer: (id: string, updates: Partial<Customer>) => void;
    selectionMode?: boolean;
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
    leadNumbers?: Record<string, number>; // external absolute mapping optional
};

function fmt(dateStr?: string) {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-');
        const dte = new Date(Number(y), Number(m) - 1, Number(d));
        return dte.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
}

export default function CustomerCards({ data, onUpdateCustomer, selectionMode = false, selectedIds, onToggleSelect, leadNumbers: externalLeadNumbers }: Props) {
    const { customStatusColors } = useTheme();
    const internalLeadNumbers = computeLeadNumbers(data);
    const leadNumbers = externalLeadNumbers || internalLeadNumbers;
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {data.map(c => (
                    <CustomerCard
                        key={c.id}
                        customer={c}
                        leadNumber={leadNumbers[c.id]}
                        customStatusColors={customStatusColors}
                        onUpdateCustomer={onUpdateCustomer}
                        selectionMode={selectionMode}
                        selected={!!selectedIds?.has(c.id)}
                        onToggleSelect={onToggleSelect}
                    />
                ))}
            </div>
        </div>
    );
}

function CustomerCard({ customer: c, /* leadNumber */ customStatusColors, onUpdateCustomer, selectionMode, selected, onToggleSelect }: { customer: Customer; leadNumber?: number; customStatusColors: Record<string, string>; onUpdateCustomer: (id: string, updates: Partial<Customer>) => void; selectionMode?: boolean; selected?: boolean; onToggleSelect?: (id: string) => void }) {
    const [editingField, setEditingField] = useState<keyof Customer | null>(null);
    const [draftValue, setDraftValue] = useState<string>('');

    const beginEdit = <K extends keyof Customer>(field: K, current: Customer[K] | undefined) => {
        setEditingField(field);
        setDraftValue((current ?? '') as string);
    };
    const save = () => {
        if (!editingField) return;
        onUpdateCustomer(c.id, { [editingField]: draftValue });
        setEditingField(null);
    };
    const cancel = () => setEditingField(null);

    const renderInline = (field: keyof Customer, display: React.ReactNode) => {
        const isEditing = editingField === field;
        if (isEditing) {
            const isSource = field === 'source';
            return (
                <span className="flex items-center gap-1">
                    {isSource ? (
                        <select
                            autoFocus
                            className="px-1 py-0.5 border rounded text-xs bg-white"
                            value={draftValue}
                            onChange={e => setDraftValue(e.target.value)}
                        >
                            <option value="">--</option>
                            {SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : (
                        <input
                            autoFocus
                            className="px-1 py-0.5 border rounded text-xs"
                            value={draftValue}
                            onChange={e => setDraftValue(e.target.value)}
                        />
                    )}
                    <button onClick={save} className="p-0.5 text-green-600 hover:bg-green-50 rounded"><Save size={12} /></button>
                    <button onClick={cancel} className="p-0.5 text-red-600 hover:bg-red-50 rounded"><X size={12} /></button>
                </span>
            );
        }
        return (
            <span
                onClick={() => beginEdit(field, c[field])}
                className="cursor-pointer hover:underline flex items-center gap-1 group"
            >
                {display}
                <Edit3 size={12} className="opacity-0 group-hover:opacity-100 text-gray-400" />
            </span>
        );
    };

    const firstClr = c.firstCallStatus && customStatusColors[c.firstCallStatus] ? deriveBadgePalette(customStatusColors[c.firstCallStatus]) : null;
    const secondClr = c.secondCallStatus && customStatusColors[c.secondCallStatus] ? deriveBadgePalette(customStatusColors[c.secondCallStatus]) : null;
    const finalClr = c.finalStatus && customStatusColors[c.finalStatus] ? deriveBadgePalette(customStatusColors[c.finalStatus]) : null;
    return (
        <div className={`relative bg-[var(--brand-card-bg)] rounded-2xl shadow-sm border p-5 hover:shadow-md transition ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-[var(--brand-border)]'}`}>
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
            <div className="mb-4">
                <CustomerProgressBar customer={c} />
            </div>
            <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-gray-900 flex-wrap">
                        <User size={16} className="text-[var(--brand-text-secondary)]" />
                        <h3 className="text-base font-extrabold">
                            {renderInline('name', <><span className="text-[var(--brand-text-primary)]">{c.name || 'Unnamed'}</span></>)}
                        </h3>
                        {renderInline('source', (
                            c.source ? <Badge color={c.source === 'WhatsApp' ? 'emerald' : c.source === 'Facebook' ? 'blue' : c.source === 'Instagram' ? 'pink' : 'cyan'}>{c.source}</Badge> : <span className="text-xs text-gray-500 inline-flex items-center gap-1"><Layers size={12} />Source</span>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone size={16} className="text-gray-400" />
                        {renderInline('phone', <span>{c.phone || 'No phone'}</span>)}
                    </div>
                    {c.email && (
                        <div className="text-xs text-gray-500 break-all">
                            {renderInline('email', <span>{c.email}</span>)}
                        </div>
                    )}
                </div>
                <div className="text-xs text-[var(--brand-text-secondary)] flex items-center gap-1"><CalendarDays size={14} /> Added: {fmt(c.dateAdded) || '—'}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Date Added">
                    <Input type="date" value={c.dateAdded || ""} onChange={(e) => onUpdateCustomer(c.id, { dateAdded: e.target.value })} />
                </Field>
                <Field label="First Contact Date" icon={<CalendarDays size={14} className="text-gray-400" />}>
                    <Input type="date" value={c.firstCallDate || ""} onChange={(e) => onUpdateCustomer(c.id, { firstCallDate: e.target.value })} />
                </Field>
                <Field label="First Call Status" icon={<CheckCircle2 size={14} className="text-gray-400" />}>
                    <Select value={c.firstCallStatus || ""} onChange={(e) => {
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
                    }}>
                        <option value="">Select...</option>
                        {FIRST_CALL_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </Select>
                    {c.firstCallStatus && firstClr && <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: firstClr.bg, border: `1px solid ${firstClr.border}`, color: firstClr.text }}>{c.firstCallStatus}</span>}
                </Field>
                <Field label="Second Contact Date" icon={<CalendarDays size={14} className="text-gray-400" />}>
                    <Input type="date" value={c.secondCallDate || ""} onChange={(e) => onUpdateCustomer(c.id, { secondCallDate: e.target.value })} />
                </Field>
                <Field label="Second Call Status" icon={<Clock3 size={14} className="text-gray-400" />}>
                    <Select value={c.secondCallStatus || ""} onChange={(e) => {
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
                    }}>
                        <option value="">Select...</option>
                        {SECOND_CALL_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </Select>
                    {c.secondCallStatus && secondClr && <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: secondClr.bg, border: `1px solid ${secondClr.border}`, color: secondClr.text }}>{c.secondCallStatus}</span>}
                </Field>
                <Field label="Final Status" icon={<CheckCircle2 size={14} className="text-gray-400" />}>
                    <Select value={c.finalStatus || ""} onChange={(e) => onUpdateCustomer(c.id, { finalStatus: e.target.value as Customer["finalStatus"] })}>
                        <option value="">Select...</option>
                        {FINAL_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </Select>
                    {c.finalStatus && finalClr && <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: finalClr.bg, border: `1px solid ${finalClr.border}`, color: finalClr.text }}>{c.finalStatus}</span>}
                </Field>
                <Field label="Final Date" icon={<CalendarDays size={14} className="text-gray-400" />}>
                    <Input type="date" value={c.finalCallDate || ""} onChange={(e) => onUpdateCustomer(c.id, { finalCallDate: e.target.value })} />
                </Field>
                <div className="sm:col-span-2">
                    <Field label="Notes" icon={<FileText size={14} className="text-gray-400" />}>
                        <TextArea value={c.notes || ""} onChange={(e) => onUpdateCustomer(c.id, { notes: e.target.value })} rows={3} />
                    </Field>
                </div>
            </div>
        </div>
    );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <label className="block text-sm">
            <span className="text-gray-700 font-semibold flex items-center gap-2">{icon}{label}</span>
            <div className="mt-1">{children}</div>
        </label>
    );
}
