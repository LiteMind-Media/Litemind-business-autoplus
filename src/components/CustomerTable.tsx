'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
} from '@tanstack/react-table';
import { Customer, SOURCE_OPTIONS, FIRST_CALL_STATUS_OPTIONS, SECOND_CALL_STATUS_OPTIONS, FINAL_STATUS_OPTIONS } from '@/types/customer';
import { ChevronUp, ChevronDown, Edit3, Save, X, CalendarDays, Layers, BadgeCheck, Clock3, CheckCircle2 } from 'lucide-react';
import Badge from './Badge';
import { statusColorFromMap } from './UI';
import { useTheme } from '@/hooks/useTheme';
import CustomerProgressBar from './CustomerProgressBar';

const columnHelper = createColumnHelper<Customer>();

interface CustomerTableProps {
  data: Customer[];
  onUpdateCustomer: (id: string, updates: Partial<Customer>) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onVisibleIdsChange?: (ids: string[]) => void;
  mode?: 'full' | 'compact'; // compact: limited columns, no inline edit
  onOpenCustomer?: (id: string) => void; // used in compact mode row click
  leadNumbers?: Record<string, number>; // global absolute numbering (if provided, overrides local computation)
  pageIndex?: number; // externally controlled page index (optional)
  onPageIndexChange?: (index: number) => void; // notify parent of page change
}

export default function CustomerTable({ data, onUpdateCustomer, selectionMode = false, selectedIds, onToggleSelect, onVisibleIdsChange, mode = 'full', onOpenCustomer, leadNumbers, pageIndex, onPageIndexChange }: CustomerTableProps) {
  const { customStatusColors } = useTheme();
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  // Controlled pagination support: if parent provides pageIndex we mirror it, else manage local
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const effectivePageIndex = pageIndex ?? internalPageIndex;
  // Selection scope: 'page' (default) or 'all' filtered rows
  const [selectionScope, setSelectionScope] = useState<'page' | 'all'>('page');
  // (Removed in-view filters UI; filtering now handled globally in parent view)

  const handleStartEdit = useCallback((rowId: string, field: string, currentValue: string) => {
    setEditingCell(`${rowId}-${field}`);
    setEditValue(currentValue);
  }, []);

  const handleSaveEdit = useCallback((rowId: string, field: keyof Customer) => {
    onUpdateCustomer(rowId, { [field]: editValue });
    setEditingCell(null);
    setEditValue('');
  }, [editValue, onUpdateCustomer]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  // Removed unused localNumbered computation (global numbering supplied by parent via leadNumbers)

  // Lead numbering currently supplied via props (globalLeadNumbers)

  const columns = useMemo<ColumnDef<Customer>[]>(() => {
    // Compact mode: only a subset of columns, no inline editing
    if (mode === 'compact') {
      const cols: ColumnDef<Customer>[] = [
        {
          id: 'progress',
          header: 'Progress',
          cell: ({ row }: { row: { original: Customer } }) => <CustomerProgressBar customer={row.original} />,
          enableSorting: false,
        },
        // Global numbering column (absolute lead number) if mapping provided
        ...(leadNumbers ? [
          {
            id: 'num',
            header: '#',
            cell: ({ row }: { row: { original: Customer } }) => {
              const num = leadNumbers[row.original.id];
              return <span className="text-gray-500 font-semibold tabular-nums">{num != null ? num : '—'}</span>;
            },
            enableSorting: false,
          } as ColumnDef<Customer>
        ] : []),
        columnHelper.accessor('name', { header: 'Name', cell: ({ getValue }) => <span className="font-semibold text-gray-900">{getValue()}</span> }) as ColumnDef<Customer>,
        columnHelper.accessor('phone', { header: 'Phone', cell: ({ getValue }) => <span className="font-semibold text-gray-900">{getValue()}</span> }) as ColumnDef<Customer>,
        columnHelper.accessor('dateAdded', {
          header: 'Date Added', cell: ({ getValue }) => {
            const raw = getValue<string>() || ''; let display = raw;
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) { const [y, m, d] = raw.split('-'); const date = new Date(Number(y), Number(m) - 1, Number(d)); display = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
            return <span className="font-semibold text-gray-900">{display}</span>;
          }
        }) as ColumnDef<Customer>,
        columnHelper.accessor('finalStatus', {
          header: 'Registered', cell: ({ getValue }) => {
            const value = getValue<string>() || '';
            const isReg = value === 'Registered';
            return isReg ? <Badge color='emerald'>Yes</Badge> : <span className="text-gray-400 font-semibold">—</span>;
          }
        }) as ColumnDef<Customer>,
      ];
      if (selectionMode) {
        cols.unshift({
          id: 'select',
          header: ({ table }: { table: { getRowModel: () => { rows: { original: Customer }[] }; getFilteredRowModel: () => { rows: { original: Customer }[] } } }) => {
            const pageIds: string[] = table.getRowModel().rows.map((r) => r.original.id);
            const filteredIds: string[] = table.getFilteredRowModel().rows.map((r) => r.original.id);
            const scopeIds = selectionScope === 'all' ? filteredIds : pageIds;
            const total = scopeIds.length;
            const selectedCount = scopeIds.filter(id => selectedIds?.has(id)).length;
            const allSelected = total > 0 && selectedCount === total;
            const partiallySelected = selectedCount > 0 && !allSelected;
            return (
              <div className="flex flex-col items-start gap-1 min-w-[44px]">
                <input
                  type="checkbox"
                  ref={el => { if (el) el.indeterminate = partiallySelected; }}
                  className="h-4 w-4 cursor-pointer"
                  aria-label={selectionScope === 'all' ? 'Select all filtered' : 'Select all on page'}
                  checked={allSelected}
                  onChange={() => {
                    if (!onToggleSelect) return;
                    if (allSelected) {
                      scopeIds.forEach(id => { if (selectedIds?.has(id)) onToggleSelect(id); });
                    } else {
                      scopeIds.forEach(id => { if (!selectedIds?.has(id)) onToggleSelect(id); });
                    }
                  }}
                />
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold text-gray-500 leading-none">
                    {selectedCount}/{total}
                  </span>
                  <button
                    type="button"
                    className="text-[9px] px-1 py-0.5 rounded border text-gray-600 hover:bg-gray-100"
                    title={selectionScope === 'all' ? 'Switch to page scope' : 'Switch to all filtered rows'}
                    onClick={(e) => { e.stopPropagation(); setSelectionScope(s => s === 'all' ? 'page' : 'all'); }}
                  >{selectionScope === 'all' ? 'All' : 'Pg'}</button>
                </div>
              </div>
            );
          },
          cell: ({ row }: { row: { original: Customer } }) => (
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer"
              checked={!!selectedIds?.has(row.original.id)}
              onChange={() => onToggleSelect && onToggleSelect(row.original.id)}
            />
          ),
          enableSorting: false,
        });
      }
      return cols;
    }
    interface EditableCellCtx { getValue: () => string; row: { id: string; original: Customer }; column: { id: string } }
    const EditableCell = ({ getValue, row, column }: EditableCellCtx) => {
      const cellId = `${row.id}-${column.id}`;
      const isEditing = editingCell === cellId;
      const currentValue = getValue();
      if (isEditing) {
        const field = column.id as keyof Customer;
        const isDate = ['dateAdded', 'firstCallDate', 'secondCallDate', 'finalCallDate'].includes(field as string);
        const isSelectSource = field === 'source';
        const isSelectFirst = field === 'firstCallStatus';
        const isSelectSecond = field === 'secondCallStatus';
        const isSelectFinal = field === 'finalStatus';
        return (
          <div className="flex items-center gap-2">
            {isDate && (
              <input type="date" value={editValue} onChange={e => setEditValue(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1" autoFocus />
            )}
            {isSelectSource && (
              <select value={editValue} onChange={e => setEditValue(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1 bg-white" autoFocus>
                <option value="">--</option>
                {SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {isSelectFirst && (
              <select value={editValue} onChange={e => setEditValue(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1 bg-white" autoFocus>
                <option value="">--</option>
                {FIRST_CALL_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {isSelectSecond && (
              <select value={editValue} onChange={e => setEditValue(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1 bg-white" autoFocus>
                <option value="">--</option>
                {SECOND_CALL_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {isSelectFinal && (
              <select value={editValue} onChange={e => setEditValue(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1 bg-white" autoFocus>
                <option value="">--</option>
                {FINAL_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {!isDate && !isSelectSource && !isSelectFirst && !isSelectSecond && !isSelectFinal && (
              <input value={editValue} onChange={e => setEditValue(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1" autoFocus />
            )}
            <button onClick={() => handleSaveEdit(row.original.id, field)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save size={14} /></button>
            <button onClick={handleCancelEdit} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={14} /></button>
          </div>
        );
      }
      return (
        <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => handleStartEdit(row.id, column.id, currentValue)}>
          <span className="text-gray-900 font-semibold">{currentValue}</span>
          <Edit3 size={12} className="opacity-0 group-hover:opacity-100 text-gray-400" />
        </div>
      );
    };

    const cols: ColumnDef<Customer>[] = [
      {
        id: 'progress',
        header: 'Progress',
        cell: ({ row }: { row: { original: Customer } }) => <CustomerProgressBar customer={row.original} />,
        enableSorting: false,
      },
      // Global numbering column when provided
      ...(leadNumbers ? [
        {
          id: 'num',
          header: '#',
          cell: ({ row }: { row: { original: Customer } }) => {
            const num = leadNumbers[row.original.id];
            return <span className="text-gray-500 font-semibold tabular-nums">{num != null ? num : '—'}</span>;
          },
          enableSorting: true,
          // Provide a stable numeric ordering based on absolute lead number mapping
          sortingFn: (a, b) => {
            // a and b are Row<Customer>
            const av = leadNumbers[a.original.id] ?? 0;
            const bv = leadNumbers[b.original.id] ?? 0;
            return av - bv;
          }
        } as ColumnDef<Customer>
      ] : []),
      columnHelper.accessor('name', { header: 'Name', cell: EditableCell }) as ColumnDef<Customer>,
      columnHelper.accessor('phone', { header: 'Phone', cell: EditableCell }) as ColumnDef<Customer>,
      columnHelper.display({
        id: 'dupes',
        header: 'Duplicates',
        cell: ({ row }) => {
          const c = row.original;
          const totalDupes = (c.duplicateLeadIds?.length || 0);
          if (!totalDupes) return <span className="text-xs text-gray-400 font-semibold">—</span>;
          const count = totalDupes + 1; // including canonical
          return (
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                {count}× signup{count > 1 ? 's' : ''}
              </span>
              {c.duplicateDateAdds && c.duplicateDateAdds.length > 0 && (
                <span className="text-[10px] leading-tight text-gray-500 font-semibold max-w-[120px] truncate" title={['Primary:' + c.dateAdded, ...c.duplicateDateAdds].join(', ')}>
                  {[c.dateAdded, ...c.duplicateDateAdds].filter(Boolean).slice(0, 3).join(', ')}{(c.duplicateDateAdds.length + 1) > 3 ? '…' : ''}
                </span>
              )}
            </div>
          );
        }
      }) as ColumnDef<Customer>,
      columnHelper.accessor('email', {
        header: 'Email', cell: ({ getValue, row, column }) => {
          const wrapped: EditableCellCtx = { getValue: () => (getValue() || '') as string, row, column };
          return EditableCell(wrapped);
        }
      }) as ColumnDef<Customer>,
      columnHelper.accessor('source', {
        header: () => <div className="flex items-center gap-2"><Layers size={14} /> Source</div>,
        cell: ({ getValue, row, column }) => {
          const cellId = `${row.id}-${column.id}`;
          const isEditing = editingCell === cellId;
          const value = getValue();
          if (isEditing) {
            return (
              <div className="flex items-center gap-2">
                <select value={editValue} onChange={e => setEditValue(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1 bg-white" autoFocus>
                  <option value="">--</option>
                  {SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button onClick={() => handleSaveEdit(row.original.id, 'source')} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save size={14} /></button>
                <button onClick={handleCancelEdit} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={14} /></button>
              </div>
            );
          }
          const color = (value === 'WhatsApp' ? 'emerald' : value === 'Facebook' ? 'blue' : value === 'Instagram' ? 'pink' : value === 'TikTok' ? 'purple' : 'cyan');
          return (
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => handleStartEdit(row.id, column.id, value)}>
              {value ? <Badge color={color}>{value}</Badge> : <span className="text-gray-700 font-semibold">Select...</span>}
              <Edit3 size={12} className="opacity-0 group-hover:opacity-100 text-gray-400" />
            </div>
          );
        },
      }) as ColumnDef<Customer>,
      columnHelper.accessor('dateAdded', {
        header: () => <div className="flex items-center gap-2"><CalendarDays size={14} /> Date Added</div>, cell: ({ getValue, row, column }) => {
          const cellId = `${row.id}-${column.id}`;
          const isEditing = editingCell === cellId;
          const raw = getValue<string>() || '';
          if (isEditing) {
            return EditableCell({ getValue: () => raw, row, column });
          }
          let display = raw;
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const [y, m, d] = raw.split('-');
            const date = new Date(Number(y), Number(m) - 1, Number(d));
            display = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          }
          return (
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => handleStartEdit(row.id, column.id, raw)}>
              <span className="text-gray-900 font-semibold">{display}</span>
              <Edit3 size={12} className="opacity-0 group-hover:opacity-100 text-gray-400" />
            </div>
          );
        }
      }) as ColumnDef<Customer>,
      columnHelper.accessor('firstCallDate', {
        header: 'First Call Date', cell: ({ getValue, row, column }) => {
          const cellId = `${row.id}-${column.id}`;
          const isEditing = editingCell === cellId;
          const raw = getValue<string>() || '';
          if (isEditing) return EditableCell({ getValue: () => raw, row, column });
          let display = raw;
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const [y, m, d] = raw.split('-');
            const date = new Date(Number(y), Number(m) - 1, Number(d));
            display = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          }
          return (
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => handleStartEdit(row.id, column.id, raw)}>
              <span className="text-gray-900 font-semibold">{display}</span>
              <Edit3 size={12} className="opacity-0 group-hover:opacity-100 text-gray-400" />
            </div>
          );
        }
      }) as ColumnDef<Customer>,
      columnHelper.accessor('firstCallStatus', {
        header: () => <div className="flex items-center gap-2"><BadgeCheck size={14} /> First Call Status</div>,
        cell: ({ getValue, row, column }) => {
          const cellId = `${row.id}-${column.id}`;
          const isEditing = editingCell === cellId;
          const value = getValue();
          if (isEditing) {
            return (
              <div className="flex items-center gap-2">
                <select value={editValue} onChange={e => setEditValue(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1 bg-white" autoFocus>
                  <option value="">--</option>
                  {FIRST_CALL_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button onClick={() => handleSaveEdit(row.original.id, 'firstCallStatus')} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save size={14} /></button>
                <button onClick={handleCancelEdit} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={14} /></button>
              </div>
            );
          }
          const color = statusColorFromMap(customStatusColors, 'first', value);
          const badgeColor = typeof color === 'string' ? color : (color && 'custom' in color ? undefined : undefined);
          return (
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => handleStartEdit(row.id, column.id, value)}>
              {value ? (typeof color === 'object' && 'custom' in color ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border" style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}>{value}</span> : <Badge color={badgeColor}>{value}</Badge>) : <span className="text-gray-700 font-semibold">Select...</span>}
              <Edit3 size={12} className="opacity-0 group-hover:opacity-100 text-gray-400" />
            </div>
          );
        },
      }) as ColumnDef<Customer>,
      columnHelper.accessor('notes', { header: 'Notes', cell: EditableCell }) as ColumnDef<Customer>,
      columnHelper.accessor('secondCallDate', {
        header: 'Second Call Date', cell: ({ getValue, row, column }) => {
          const cellId = `${row.id}-${column.id}`;
          const isEditing = editingCell === cellId;
          const raw = getValue<string>() || '';
          if (isEditing) return EditableCell({ getValue: () => raw, row, column });
          let display = raw;
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const [y, m, d] = raw.split('-');
            const date = new Date(Number(y), Number(m) - 1, Number(d));
            display = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          }
          return (
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => handleStartEdit(row.id, column.id, raw)}>
              <span className="text-gray-900 font-semibold">{display}</span>
              <Edit3 size={12} className="opacity-0 group-hover:opacity-100 text-gray-400" />
            </div>
          );
        }
      }) as ColumnDef<Customer>,
      columnHelper.accessor('secondCallStatus', {
        header: () => <div className="flex items-center gap-2"><Clock3 size={14} /> Second Call Status</div>,
        cell: ({ getValue, row, column }) => {
          const cellId = `${row.id}-${column.id}`;
          const isEditing = editingCell === cellId;
          const value = getValue();
          if (isEditing) {
            return (
              <div className="flex items-center gap-2">
                <select value={editValue} onChange={e => setEditValue(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1 bg-white" autoFocus>
                  <option value="">--</option>
                  {SECOND_CALL_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button onClick={() => handleSaveEdit(row.original.id, 'secondCallStatus')} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save size={14} /></button>
                <button onClick={handleCancelEdit} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={14} /></button>
              </div>
            );
          }
          const color = statusColorFromMap(customStatusColors, 'second', value);
          const badgeColor = typeof color === 'string' ? color : (color && 'custom' in color ? undefined : undefined);
          return (
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => handleStartEdit(row.id, column.id, value)}>
              {value ? (typeof color === 'object' && 'custom' in color ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border" style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}>{value}</span> : <Badge color={badgeColor}>{value}</Badge>) : <span className="text-gray-700 font-semibold">Select...</span>}
              <Edit3 size={12} className="opacity-0 group-hover:opacity-100 text-gray-400" />
            </div>
          );
        },
      }) as ColumnDef<Customer>,
      columnHelper.accessor('finalStatus', {
        header: () => <div className="flex items-center gap-2"><CheckCircle2 size={14} /> Final Status</div>,
        cell: ({ getValue, row, column }) => {
          const cellId = `${row.id}-${column.id}`;
          const isEditing = editingCell === cellId;
          const value = getValue();
          if (isEditing) {
            return (
              <div className="flex items-center gap-2">
                <select value={editValue} onChange={e => setEditValue(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1 bg-white" autoFocus>
                  <option value="">--</option>
                  {FINAL_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button onClick={() => handleSaveEdit(row.original.id, 'finalStatus')} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save size={14} /></button>
                <button onClick={handleCancelEdit} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={14} /></button>
              </div>
            );
          }
          const color = statusColorFromMap(customStatusColors, 'final', value);
          const badgeColor = typeof color === 'string' ? color : (color && 'custom' in color ? undefined : undefined);
          return (
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => handleStartEdit(row.id, column.id, value)}>
              {value ? (typeof color === 'object' && 'custom' in color ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border" style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}>{value}</span> : <Badge color={badgeColor}>{value}</Badge>) : <span className="text-gray-700 font-semibold">Select...</span>}
              <Edit3 size={12} className="opacity-0 group-hover:opacity-100 text-gray-400" />
            </div>
          );
        },
      }) as ColumnDef<Customer>,
    ];

    if (selectionMode) {
      cols.unshift({
        id: 'select',
        header: ({ table }) => {
          const pageIds: string[] = table.getRowModel().rows.map((r: { original: Customer }) => r.original.id);
          const filteredIds: string[] = table.getFilteredRowModel().rows.map((r: { original: Customer }) => r.original.id);
          const scopeIds = selectionScope === 'all' ? filteredIds : pageIds;
          const total = scopeIds.length;
          const selectedCount = scopeIds.filter(id => selectedIds?.has(id)).length;
          const allSelected = total > 0 && selectedCount === total;
          const partiallySelected = selectedCount > 0 && !allSelected;
          return (
            <div className="flex flex-col items-start gap-1 min-w-[44px]">
              <input
                type="checkbox"
                ref={el => { if (el) el.indeterminate = partiallySelected; }}
                className="h-4 w-4 cursor-pointer"
                aria-label={selectionScope === 'all' ? 'Select all filtered' : 'Select all on page'}
                checked={allSelected}
                onChange={() => {
                  if (!onToggleSelect) return;
                  if (allSelected) scopeIds.forEach(id => { if (selectedIds?.has(id)) onToggleSelect(id); });
                  else scopeIds.forEach(id => { if (!selectedIds?.has(id)) onToggleSelect(id); });
                }}
              />
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-gray-500 leading-none">
                  {selectedCount}/{total}
                </span>
                <button
                  type="button"
                  className="text-[9px] px-1 py-0.5 rounded border text-gray-600 hover:bg-gray-100"
                  title={selectionScope === 'all' ? 'Switch to page scope' : 'Switch to all filtered rows'}
                  onClick={(e) => { e.stopPropagation(); setSelectionScope(s => s === 'all' ? 'page' : 'all'); }}
                >{selectionScope === 'all' ? 'All' : 'Pg'}</button>
              </div>
            </div>
          );
        },
        cell: ({ row }: { row: { original: Customer } }) => (
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer"
            checked={!!selectedIds?.has(row.original.id)}
            onChange={() => onToggleSelect && onToggleSelect(row.original.id)}
          />
        ),
        enableSorting: false,
      });
    }

    return cols;
  }, [mode, editingCell, editValue, handleSaveEdit, handleCancelEdit, handleStartEdit, selectionMode, selectedIds, onToggleSelect, selectionScope, customStatusColors, leadNumbers]);

  // (removed old columns definition; only use the new useMemo-based columns below)

  // Report visible IDs (already globally filtered) to parent for select-all-current functionality
  useEffect(() => {
    if (onVisibleIdsChange) onVisibleIdsChange(data.map(c => c.id));
  }, [data, onVisibleIdsChange]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    state: {
      pagination: { pageIndex: effectivePageIndex, pageSize: 25 }
    },
    onPaginationChange: (updater) => {
      const current = { pageIndex: effectivePageIndex, pageSize: 25 };
      const next = typeof updater === 'function' ? (updater as (old: typeof current) => typeof current)(current) : updater;
      if (onPageIndexChange) onPageIndexChange(next.pageIndex);
      else setInternalPageIndex(next.pageIndex);
    }
  });

  return (
    <div className="space-y-4">
      {/* Filters & progress legend removed (now in global header & bell) */}
      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="" style={{ background: 'var(--brand-muted-bg)', color: 'var(--brand-text-secondary)' }}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-sm font-semibold cursor-pointer"
                      style={{ color: 'var(--brand-text-secondary)' }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <ChevronUp size={16} className="opacity-70" />}
                        {header.column.getIsSorted() === 'desc' && <ChevronDown size={16} className="opacity-70" />}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.map(row => {
                const isSelected = selectedIds?.has(row.original.id);
                const clickable = mode === 'compact' && (onOpenCustomer || selectionMode);
                return (
                  <tr
                    key={row.id}
                    onClick={() => {
                      if (mode === 'compact') {
                        if (selectionMode && onToggleSelect) {
                          onToggleSelect(row.original.id);
                        } else if (onOpenCustomer) {
                          onOpenCustomer(row.original.id);
                        }
                      }
                    }}
                    className={`${clickable ? 'cursor-pointer' : ''} hover:bg-gray-50 ${isSelected ? 'bg-blue-50/60' : ''}`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3 text-sm text-gray-900 font-semibold">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <div className="text-sm text-gray-700">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{' '}
            of {table.getFilteredRowModel().rows.length} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
