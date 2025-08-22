"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Customer, SOURCE_OPTIONS, FIRST_CALL_STATUS_OPTIONS, SECOND_CALL_STATUS_OPTIONS, FINAL_STATUS_OPTIONS } from '@/types/customer';
import { X, User2, Phone, Mail, Layers, BadgeCheck, CalendarDays } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { deriveBadgePalette } from '@/utils/color';

interface CustomerModalProps {
    customer: Customer | null;
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<Customer>) => void;
}

const quickActions = [
    { id: 'setFirstContact', label: 'Set 1st Contact Today' },
    { id: 'markInterested', label: 'Mark Interested' },
    { id: 'setSecondContact', label: 'Set 2nd Contact Today' },
    { id: 'registerAll', label: 'Mark Registered' },
    { id: 'followUpAll', label: 'Mark Follow-up' },
] as const;
type QuickActionId = typeof quickActions[number]['id'];

function pretty(dateStr?: string) {
    if (!dateStr) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-');
        const dte = new Date(Number(y), Number(m) - 1, Number(d));
        return dte.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
}

export function CustomerModal({ customer, onClose, onUpdate }: CustomerModalProps) {
    const [form, setForm] = useState<Customer | null>(customer);
    const [manualOverride, setManualOverride] = useState(false);
    const [dirtyKeys, setDirtyKeys] = useState<Set<keyof Customer>>(new Set());
    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

    useEffect(() => { setForm(customer); setManualOverride(false); setDirtyKeys(new Set()); }, [customer]);
    if (!customer || !form) return null;

    const markDirty = (k: keyof Customer) => setDirtyKeys(prev => new Set(prev).add(k));
    const setField = <K extends keyof Customer>(key: K, value: Customer[K]) => {
        setForm(f => f ? { ...f, [key]: value } : f); markDirty(key);
    };

    const applyPatch = (patch: Partial<Customer>) => {
        if (!Object.keys(patch).length) return;
        onUpdate(customer.id, patch);
    };

    // Status handlers with auto date stamping
    const updateFirstStatus = (status: Customer['firstCallStatus']) => {
        const patch: Partial<Customer> = { firstCallStatus: status };
        setField('firstCallStatus', status);
        if (status && !form.firstCallDate) { patch.firstCallDate = today; setField('firstCallDate', today); }
        applyPatch(patch);
    };
    const updateSecondStatus = (status: Customer['secondCallStatus']) => {
        const patch: Partial<Customer> = { secondCallStatus: status };
        setField('secondCallStatus', status);
        if (status && !form.secondCallDate) { patch.secondCallDate = today; setField('secondCallDate', today); }
        applyPatch(patch);
    };
    const updateFinalStatus = (status: Customer['finalStatus']) => {
        const patch: Partial<Customer> = { finalStatus: status };
        setField('finalStatus', status);
        if (status === 'Registered' && !form.finalCallDate) { patch.finalCallDate = today; setField('finalCallDate', today); }
        applyPatch(patch);
    };

    const commitAndClose = () => {
        if (!form) return onClose();
        const patch: Partial<Customer> = {};
        dirtyKeys.forEach(k => { if (form[k] !== customer[k]) (patch as any)[k] = form[k]; });
        if (Object.keys(patch).length) applyPatch(patch);
        onClose();
    };

    const runQuick = (id: QuickActionId) => {
        if (!form) return;
        const updates: Partial<Customer> = {};
        switch (id) {
            case 'setFirstContact': if (!form.firstCallDate) { updates.firstCallDate = today; setField('firstCallDate', today); } break;
            case 'markInterested': if (form.firstCallDate && !form.firstCallStatus) { updates.firstCallStatus = 'Interested'; setField('firstCallStatus', 'Interested'); } break;
            case 'setSecondContact': if (form.firstCallStatus && !form.secondCallDate) { updates.secondCallDate = today; setField('secondCallDate', today); updates.secondCallStatus = 'We Called'; setField('secondCallStatus', 'We Called'); } break;
            case 'registerAll': if (form.firstCallStatus && !form.finalStatus) { updates.finalStatus = 'Registered'; setField('finalStatus', 'Registered'); updates.finalCallDate = today; setField('finalCallDate', today); } break;
            case 'followUpAll': if (form.firstCallStatus && !form.finalStatus) { updates.finalStatus = 'Follow-up Needed'; setField('finalStatus', 'Follow-up Needed'); updates.finalCallDate = today; setField('finalCallDate', today); } break;
        }
        applyPatch(updates);
    };

    const { customStatusColors } = useTheme();

    const initials = (form.name || 'C').split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
    const statusBadges: { label: string; value?: string | null }[] = [
        { label: '1st', value: form.firstCallStatus },
        { label: '2nd', value: form.secondCallStatus },
        { label: 'Final', value: form.finalStatus }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={commitAndClose} />
            <div className="relative z-10 w-full max-w-5xl rounded-[2rem] overflow-hidden shadow-[0_20px_60px_-10px_rgba(0,0,0,0.45)] ring-1 ring-[var(--brand-border)]" style={{ background: 'linear-gradient(145deg,var(--brand-muted-bg),var(--brand-card-bg) 60%)' }}>
                {/* Header */}
                <div className="px-8 pt-7 pb-6 border-b" style={{ borderColor: 'var(--brand-border)', background: 'linear-gradient(90deg,var(--brand-card-bg),var(--brand-muted-bg))' }}>
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-5">
                            <div className="relative">
                                <div className="h-20 w-20 rounded-2xl font-bold text-xl flex items-center justify-center ring-1" style={{ background: 'var(--brand-card-bg)', borderColor: 'var(--brand-border)', color: 'var(--brand-text-primary)', boxShadow: 'inset 0 0 0 1px var(--brand-border),0 4px 12px -2px rgba(0,0,0,0.25)' }}>{initials}</div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center flex-wrap gap-3">
                                    <h2 className="text-3xl font-black tracking-tight leading-none bg-gradient-to-r from-[var(--brand-from)] via-[var(--brand-via)] to-[var(--brand-to)] text-transparent bg-clip-text">{form.name || 'Unnamed Contact'}</h2>
                                    {form.pronouns && <span className="px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-secondary)' }}>{form.pronouns}</span>}
                                    {form.country && <span className="px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-secondary)' }}>{form.country}</span>}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {statusBadges.map(sb => {
                                        if (!sb.value) return null;
                                        const hex = customStatusColors[sb.value];
                                        const pal = hex ? deriveBadgePalette(hex) : null;
                                        return (
                                            <span key={sb.label} className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide inline-flex items-center gap-1" style={{ background: pal ? pal.bg : 'var(--brand-muted-bg)', border: '1px solid ' + (pal ? pal.border : 'var(--brand-border)'), color: pal ? pal.text : 'var(--brand-text-secondary)' }}>{sb.label}: {sb.value}</span>
                                        );
                                    })}
                                </div>
                                <div className="flex flex-wrap gap-4 text-[11px] font-medium" style={{ color: 'var(--brand-text-secondary)' }}>
                                    <div className="flex items-center gap-1"><CalendarDays size={12} /> Added {customer.dateAdded || '—'}</div>
                                    {form.source && <div className="flex items-center gap-1"><Layers size={12} /> {form.source}</div>}
                                    {form.leadScore !== undefined && <div className="flex items-center gap-1">Score: <span className="font-semibold text-[var(--brand-text-primary)]">{form.leadScore}</span></div>}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-6">
                            <div className="hidden lg:flex flex-col gap-2 text-[10px] font-medium" style={{ color: 'var(--brand-text-secondary)' }}>
                                <p>Auto-save on close</p>
                                <p>Status changes set dates</p>
                            </div>
                            <div className="flex flex-col items-end gap-3">
                                <label className="flex items-center gap-2 text-[11px] font-semibold select-none" style={{ color: 'var(--brand-text-secondary)' }}>
                                    <input type="checkbox" checked={manualOverride} onChange={e => setManualOverride(e.target.checked)} className="rounded border-gray-400 text-[var(--brand-from)] focus:ring-[var(--brand-from)]" /> Manual Dates
                                </label>
                                <button onClick={commitAndClose} className="h-11 w-11 flex items-center justify-center rounded-xl ring-1" style={{ background: 'var(--brand-card-bg)', color: 'var(--brand-text-primary)', borderColor: 'var(--brand-border)', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.35)' }} title="Close (auto-saved)"><X size={18} /></button>
                            </div>
                        </div>
                    </div>
                    {/* Quick Actions Bar */}
                    <div className="mt-6 flex flex-wrap gap-2">
                        {quickActions.map(a => (
                            <button key={a.id} onClick={() => runQuick(a.id)} className="px-4 h-9 rounded-lg text-[11px] font-semibold ring-1 transition-colors" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-primary)' }}>{a.label}</button>
                        ))}
                    </div>
                </div>
                {/* Body */}
                <div className="px-8 pb-10 pt-8 max-h-[70vh] overflow-y-auto">
                    <div className="grid gap-10 lg:grid-cols-12">
                        {/* Left Column */}
                        <div className="lg:col-span-5 space-y-10">
                            <div className="space-y-5">
                                <SectionTitle title="Contact" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <LabeledInput icon={<User2 size={14} />} label="Name" value={form.name} onChange={v => setField('name', v)} onCommit={commitAndClose} placeholder="Full name" />
                                    <LabeledInput icon={<Phone size={14} />} label="Phone" value={form.phone} onChange={v => setField('phone', v)} onCommit={commitAndClose} />
                                    <LabeledInput icon={<Mail size={14} />} label="Email" value={form.email || ''} onChange={v => setField('email', v)} onCommit={commitAndClose} placeholder="email@example.com" />
                                    <LabeledInput label="Device" value={form.device || ''} onChange={v => setField('device', v)} onCommit={commitAndClose} placeholder="iOS" />
                                    <LabeledInput label="Pronouns" value={form.pronouns || ''} onChange={v => setField('pronouns', v)} onCommit={commitAndClose} placeholder="she/her" />
                                    <LabeledInput label="Country" value={form.country || ''} onChange={v => { setField('country', v); applyPatch({ country: v }); }} onCommit={commitAndClose} />
                                </div>
                            </div>
                            <div className="space-y-5">
                                <SectionTitle title="Notes" />
                                <RichArea value={form.notes} onChange={v => setField('notes', v.slice(0, 500))} onCommit={commitAndClose} minHeight={160} placeholder="General notes..." />
                                <SectionTitle title="Final Notes" subtle />
                                <RichArea value={form.finalNotes} onChange={v => setField('finalNotes', v.slice(0, 500))} onCommit={commitAndClose} minHeight={120} placeholder="Outcome / wrap-up..." />
                            </div>
                        </div>
                        {/* Right Column */}
                        <div className="lg:col-span-7 space-y-12">
                            <div className="space-y-6">
                                <SectionTitle title="Pipeline" />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-4">
                                        <FieldLabel icon={<Layers size={14} />} label="Source" />
                                        <select value={form.source} onChange={e => { setField('source', e.target.value as Customer['source']); applyPatch({ source: e.target.value as Customer['source'] }); }} className="w-full h-11 rounded-xl px-3 text-sm font-semibold" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-primary)' }}>
                                            <option value="">—</option>
                                            {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-4 md:col-span-2">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <SelectField label="First Call" value={form.firstCallStatus} options={FIRST_CALL_STATUS_OPTIONS} onChange={v => updateFirstStatus(v as any)} />
                                            <SelectField label="Second Call" value={form.secondCallStatus} options={SECOND_CALL_STATUS_OPTIONS} onChange={v => updateSecondStatus(v as any)} />
                                            <SelectField label="Final Status" value={form.finalStatus} options={FINAL_STATUS_OPTIONS} onChange={v => updateFinalStatus(v as any)} />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <SectionTitle title="Dates" />
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px] font-medium" style={{ color: 'var(--brand-text-primary)' }}>
                                        <DateDisplay label="Added" value={form.dateAdded} immutable />
                                        {manualOverride ? <DateInput label="1st Call" value={form.firstCallDate} onChange={v => { setField('firstCallDate', v); applyPatch({ firstCallDate: v }); }} /> : <DateDisplay label="1st Call" value={form.firstCallDate} />}
                                        {manualOverride ? <DateInput label="2nd Call" value={form.secondCallDate} onChange={v => { setField('secondCallDate', v); applyPatch({ secondCallDate: v }); }} /> : <DateDisplay label="2nd Call" value={form.secondCallDate} />}
                                        {manualOverride ? <DateInput label="Final" value={form.finalCallDate} onChange={v => { setField('finalCallDate', v); applyPatch({ finalCallDate: v }); }} /> : <DateDisplay label="Final" value={form.finalCallDate} />}
                                    </div>
                                    {!manualOverride && <p className="text-[10px]" style={{ color: 'var(--brand-text-secondary)' }}>Dates auto-populate from statuses. Enable Manual Dates to edit.</p>}
                                </div>
                            </div>
                            <div className="space-y-6">
                                <SectionTitle title="Metrics" />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                                    <NumberField label="Lead Score" value={form.leadScore ?? ''} onChange={v => { setField('leadScore', v as any); applyPatch({ leadScore: v === '' ? undefined : v as number }); }} placeholder="0-100" />
                                    <ReadOnlyMetric label="Last Updated" value={form.lastUpdated ? pretty(form.lastUpdated) : '—'} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FieldLabel({ icon, label }: { icon?: React.ReactNode; label: string }) {
    return <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>{icon}{label}</div>;
}

function FieldGroup({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <FieldLabel icon={icon} label={title} />
            {children}
        </div>
    );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: 'var(--brand-text-primary)' }}>
            <span className="font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>{label}</span>
            <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className="h-10 rounded-xl px-3 text-sm font-semibold" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-primary)' }} />
        </label>
    );
}

function DateDisplay({ label, value, immutable }: { label: string; value: string; immutable?: boolean }) {
    return (
        <div className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: 'var(--brand-text-primary)' }}>
            <span className="font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>{label}</span>
            <div className={`h-10 rounded-xl px-3 text-sm font-semibold flex items-center ${immutable ? 'opacity-90' : ''}`} style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-primary)' }}>{value || '—'}</div>
        </div>
    );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: 'var(--brand-text-primary)' }}>
            <span className="font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>{label}</span>
            <select value={value} onChange={e => onChange(e.target.value)} className="h-10 rounded-xl px-3 text-sm font-semibold" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-primary)' }}>
                <option value="">—</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </label>
    );
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: number | string; onChange: (v: number | '') => void; placeholder?: string }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: 'var(--brand-text-primary)' }}>
            <span className="font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>{label}</span>
            <input value={value} placeholder={placeholder} onChange={e => {
                const v = e.target.value; if (v === '') return onChange(''); const n = Number(v); if (!isNaN(n)) onChange(n);
            }} className="h-10 rounded-xl px-3 text-sm font-semibold" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-primary)' }} />
        </label>
    );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: 'var(--brand-text-primary)' }}>
            <span className="font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>{label}</span>
            <input value={value} onChange={e => onChange(e.target.value)} className="h-10 rounded-xl px-3 text-sm font-semibold" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-primary)' }} />
        </label>
    );
}

// New premium layout building blocks
function SectionTitle({ title, subtle }: { title: string; subtle?: boolean }) {
    return (
        <div className="flex items-center gap-3">
            <h3 className={`text-xs font-extrabold tracking-[0.18em] uppercase ${subtle ? 'opacity-70' : ''}`} style={{ color: 'var(--brand-text-secondary)' }}>{title}</h3>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right,var(--brand-border),transparent)' }} />
        </div>
    );
}

function LabeledInput({ label, icon, value, onChange, onCommit, placeholder }: { label: string; icon?: React.ReactNode; value: string; onChange: (v: string) => void; onCommit: () => void; placeholder?: string }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] font-medium">
            <span className="font-semibold uppercase tracking-wide flex items-center gap-2" style={{ color: 'var(--brand-text-secondary)' }}>{icon}{label}</span>
            <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} onBlur={onCommit} className="h-11 rounded-xl px-3 text-sm font-semibold transition-colors" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-primary)' }} />
        </label>
    );
}

function RichArea({ value, onChange, onCommit, minHeight, placeholder }: { value: string; onChange: (v: string) => void; onCommit: () => void; minHeight?: number; placeholder?: string }) {
    return (
        <textarea value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} onBlur={onCommit} className="w-full rounded-2xl px-4 py-3 text-sm font-medium resize-y focus:outline-none" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-primary)', minHeight }} />
    );
}

function ReadOnlyMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: 'var(--brand-text-primary)' }}>
            <span className="font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)' }}>{label}</span>
            <div className="h-11 rounded-xl px-3 text-sm font-semibold flex items-center" style={{ background: 'var(--brand-card-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text-primary)' }}>{value || '—'}</div>
        </div>
    );
}

export default CustomerModal;
