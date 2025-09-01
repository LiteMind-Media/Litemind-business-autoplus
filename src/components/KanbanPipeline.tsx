"use client";
import { useMemo, useCallback } from 'react';
import { Customer } from '@/types/customer';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BadgeCheck, PhoneCall, ClipboardCheck, CheckCircle2, Clock3, UserPlus, CalendarDays } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { computeLeadNumbers } from '@/utils/leads';
import { deriveBadgePalette } from '@/utils/color';

interface KanbanPipelineProps {
    data: Customer[];
    onUpdateCustomer: (id: string, updates: Partial<Customer>) => void;
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onOpen: (id: string) => void;
    leadNumbers?: Record<string, number>;
}

// Pipeline columns reflect progressive funnel steps.
const columns = [
    { id: 'new', title: 'New Leads', description: 'No first contact yet' },
    { id: 'first_contact', title: '1st Contact Made', description: 'Has first call date' },
    { id: 'first_status', title: '1st Status Set', description: 'First call status chosen' },
    { id: 'second_contact', title: '2nd Contact', description: 'Second call or status present' },
    { id: 'final_registered', title: 'Registered', description: 'Final status Registered' },
    { id: 'final_other', title: 'Other Final', description: 'Follow-up or Not Registered' },
] as const;

type ColumnId = typeof columns[number]['id'];

function deriveColumnId(c: Customer): ColumnId {
    if (c.finalStatus === 'Registered') return 'final_registered';
    if (c.finalStatus === 'Follow-up Needed' || c.finalStatus === 'Not Registered') return 'final_other';
    if (c.secondCallDate || c.secondCallStatus) return 'second_contact';
    if (c.firstCallStatus) return 'first_status';
    if (c.firstCallDate) return 'first_contact';
    return 'new';
}

const columnIcon: Record<ColumnId, React.ReactNode> = {
    new: <UserPlus size={16} />,
    first_contact: <PhoneCall size={16} />,
    first_status: <BadgeCheck size={16} />,
    second_contact: <Clock3 size={16} />,
    final_registered: <CheckCircle2 size={16} />,
    final_other: <ClipboardCheck size={16} />,
};

export default function KanbanPipeline({ data, onUpdateCustomer, selectedIds, onToggleSelect, onOpen, leadNumbers: externalLeadNumbers }: KanbanPipelineProps) {
    const { customStatusColors } = useTheme();
    // Always call hook; then choose external if provided to satisfy hooks rules
    // Defensive: ensure no duplicate IDs (can happen if CSV seeding produced dup synthetic IDs before fix)
    const dedupedData = useMemo(() => {
        const seen = new Set<string>();
        return data.filter(c => {
            if (!c.id) return false;
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
        });
    }, [data]);
    const computedLeadNumbers = useMemo(() => computeLeadNumbers(dedupedData), [dedupedData]);
    const leadNumbers = externalLeadNumbers || computedLeadNumbers;
    // Group customers by derived column
    const groups = useMemo(() => {
        const map: Record<ColumnId, Customer[]> = {
            new: [],
            first_contact: [],
            first_status: [],
            second_contact: [],
            final_registered: [],
            final_other: [],
        };
        for (const c of dedupedData) map[deriveColumnId(c)].push(c);
        return map;
    }, [dedupedData]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { over, active } = event;
        if (!over) return;
        const customerId = active.id.toString();
        const targetCol = over.id.toString() as ColumnId;
        // Determine patch based on target column semantics
        const patch: Partial<Customer> = {};
        switch (targetCol) {
            case 'new':
                // Reset early stage fields
                patch.firstCallDate = '';
                patch.firstCallStatus = '';
                patch.secondCallDate = '';
                patch.secondCallStatus = '';
                patch.finalStatus = '';
                patch.finalCallDate = '';
                break;
            case 'first_contact':
                // Ensure date, but clear any statuses beyond this column
                patch.firstCallDate = patch.firstCallDate || new Date().toISOString().slice(0, 10);
                patch.firstCallStatus = '' as Customer['firstCallStatus'];
                patch.secondCallDate = '';
                patch.secondCallStatus = '' as Customer['secondCallStatus'];
                patch.finalStatus = '' as Customer['finalStatus'];
                patch.finalCallDate = '';
                break;
            case 'first_status':
                patch.firstCallDate = patch.firstCallDate || new Date().toISOString().slice(0, 10);
                patch.firstCallStatus = patch.firstCallStatus || 'Answered';
                break;
            case 'second_contact':
                patch.firstCallDate = patch.firstCallDate || new Date().toISOString().slice(0, 10);
                patch.firstCallStatus = patch.firstCallStatus || 'Answered';
                patch.secondCallDate = patch.secondCallDate || new Date().toISOString().slice(0, 10);
                patch.secondCallStatus = patch.secondCallStatus || 'We Called';
                break;
            case 'final_registered':
                patch.firstCallDate = patch.firstCallDate || new Date().toISOString().slice(0, 10);
                patch.firstCallStatus = patch.firstCallStatus || 'Interested';
                patch.secondCallDate = patch.secondCallDate || new Date().toISOString().slice(0, 10);
                patch.secondCallStatus = patch.secondCallStatus || 'Answered';
                patch.finalStatus = 'Registered';
                patch.finalCallDate = patch.finalCallDate || new Date().toISOString().slice(0, 10);
                break;
            case 'final_other':
                patch.firstCallDate = patch.firstCallDate || new Date().toISOString().slice(0, 10);
                patch.firstCallStatus = patch.firstCallStatus || 'Answered';
                patch.secondCallDate = patch.secondCallDate || new Date().toISOString().slice(0, 10);
                patch.secondCallStatus = patch.secondCallStatus || 'Answered';
                patch.finalStatus = 'Follow-up Needed';
                patch.finalCallDate = patch.finalCallDate || new Date().toISOString().slice(0, 10);
                break;
        }
        onUpdateCustomer(customerId, patch);
    }, [onUpdateCustomer]);

    return (
        <div className="w-full pb-4 lg:overflow-x-auto">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="flex flex-col lg:flex-row gap-4 lg:min-w-[1200px]">
                    {columns.map(col => (
                        <KanbanColumn
                            key={col.id}
                            id={col.id}
                            title={col.title}
                            description={col.description}
                            icon={columnIcon[col.id]}
                            customers={groups[col.id]}
                            selectedIds={selectedIds}
                            onToggleSelect={onToggleSelect}
                            onOpen={onOpen}
                            leadNumbers={leadNumbers}
                            customStatusColors={customStatusColors}
                        />
                    ))}
                </div>
            </DndContext>
        </div>
    );
}

function KanbanColumn({ id, title, description, customers, icon, selectedIds, onToggleSelect, onOpen, leadNumbers, customStatusColors }: { id: ColumnId; title: string; description: string; customers: Customer[]; icon: React.ReactNode; selectedIds: Set<string>; onToggleSelect: (id: string) => void; onOpen: (id: string) => void; leadNumbers: Record<string, number>; customStatusColors: Record<string, string>; }) {
    const allSelected = customers.length > 0 && customers.every(c => selectedIds.has(c.id));
    const someSelected = customers.some(c => selectedIds.has(c.id)) && !allSelected;
    const toggleColumn = () => {
        if (allSelected) {
            customers.forEach(c => onToggleSelect(c.id)); // unselect all
        } else {
            customers.forEach(c => { if (!selectedIds.has(c.id)) onToggleSelect(c.id); });
        }
    };
    return (
        <div className="flex-1 bg-white/70 backdrop-blur rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col w-full" id={id}>
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">{icon} {title}</div>
                <button type="button" onClick={toggleColumn} className={`h-5 w-5 rounded border text-[11px] font-bold flex items-center justify-center ${allSelected ? 'bg-blue-600 text-white border-blue-600' : someSelected ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>{allSelected ? '✓' : someSelected ? '−' : '+'}</button>
            </div>
            <div className="text-[11px] text-gray-500 mb-3">{description}</div>
            <SortableContext items={customers.map(c => c.id)} strategy={rectSortingStrategy}>
                <div className="flex flex-col gap-3">
                    {customers.map(c => <KanbanCard key={c.id} customer={c} leadNumber={leadNumbers[c.id]} customStatusColors={customStatusColors} selected={selectedIds.has(c.id)} onToggleSelect={() => onToggleSelect(c.id)} onOpen={() => onOpen(c.id)} />)}
                    {customers.length === 0 && <div className="text-xs text-gray-400 italic py-4 text-center border border-dashed rounded">No leads</div>}
                </div>
            </SortableContext>
        </div>
    );
}

function fmtDate(dateStr?: string) {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-');
        const dte = new Date(Number(y), Number(m) - 1, Number(d));
        return dte.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return dateStr;
}

function KanbanCard({ customer, /* leadNumber */ customStatusColors, selected, onToggleSelect, onOpen }: { customer: Customer; leadNumber?: number; customStatusColors: Record<string, string>; selected: boolean; onToggleSelect: () => void; onOpen: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: customer.id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    const firstClr = customer.firstCallStatus && customStatusColors[customer.firstCallStatus] ? deriveBadgePalette(customStatusColors[customer.firstCallStatus]) : null;
    const secondClr = customer.secondCallStatus && customStatusColors[customer.secondCallStatus] ? deriveBadgePalette(customStatusColors[customer.secondCallStatus]) : null;
    const finalClr = customer.finalStatus && customStatusColors[customer.finalStatus] ? deriveBadgePalette(customStatusColors[customer.finalStatus]) : null;
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`rounded-xl border bg-white shadow-sm p-3 cursor-grab active:cursor-grabbing relative group ${selected ? 'ring-2 ring-blue-500 border-blue-400' : 'border-gray-200'}`}
            {...attributes}
            {...listeners}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0" onDoubleClick={onOpen}>
                    <div className="text-sm font-semibold text-gray-900 truncate">{customer.name || 'Unnamed Lead'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{customer.phone || 'No phone'}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <button type="button" onClick={onOpen} className="text-[10px] font-semibold text-blue-600 hover:underline">Open</button>
                    <label className="inline-flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={selected} onChange={onToggleSelect} className="accent-blue-600" />
                        Sel
                    </label>
                </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
                {customer.source && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold">{customer.source}</span>}
                {customer.firstCallStatus && firstClr && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: firstClr.bg, border: `1px solid ${firstClr.border}`, color: firstClr.text }}>{customer.firstCallStatus}</span>}
                {customer.secondCallStatus && secondClr && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: secondClr.bg, border: `1px solid ${secondClr.border}`, color: secondClr.text }}>{customer.secondCallStatus}</span>}
                {customer.finalStatus && finalClr && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: finalClr.bg, border: `1px solid ${finalClr.border}`, color: finalClr.text }}>{customer.finalStatus}</span>}
                {customer.email && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium truncate max-w-[120px]" title={customer.email}>{customer.email}</span>}
            </div>
            {customer.dateAdded && (
                <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1"><CalendarDays size={10} /> {fmtDate(customer.dateAdded)}</div>
            )}
        </div>
    );
}
