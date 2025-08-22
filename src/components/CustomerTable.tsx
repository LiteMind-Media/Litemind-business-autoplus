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
import { statusColor } from './UI';
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
}

export default function CustomerTable({ data, onUpdateCustomer, selectionMode = false, selectedIds, onToggleSelect, onVisibleIdsChange, mode = 'full', onOpenCustomer, leadNumbers }: CustomerTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
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

  const localNumbered = useMemo(() => {
    if (leadNumbers) return null; // external mapping provided, skip local compute
    const pick = (c: Customer) => c.dateAdded || c.firstCallDate || c.secondCallDate || c.finalCallDate || '';
    return [...data].sort((a, b) => {
      const ad = pick(a); const bd = pick(b);
      const av = /^\d{4}-\d{2}-\d{2}$/.test(ad); const bv = /^\d{4}-\d{2}-\d{2}$/.test(bd);
      if (av && bv) {
        if (ad === bd) return a.id.localeCompare(b.id);
        return ad.localeCompare(bd);
      }
      if (av) return -1;
      if (bv) return 1;
      return 0;
    }).map((c, i) => ({ id: c.id, number: i + 1 }));
  }, [data, leadNumbers]);

  const getLeadNumber = (_id: string) => undefined; // numbering temporarily disabled

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
          header: () => <span className="text-xs font-semibold text-gray-500">Sel</span>,
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
      columnHelper.accessor('name', { header: 'Name', cell: EditableCell }) as ColumnDef<Customer>,
      columnHelper.accessor('phone', { header: 'Phone', cell: EditableCell }) as ColumnDef<Customer>,
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
          const color = statusColor('first', value);
          return (
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => handleStartEdit(row.id, column.id, value)}>
              {value ? (typeof color === 'object' && 'custom' in color ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border" style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}>{value}</span> : <Badge color={color as any}>{value}</Badge>) : <span className="text-gray-700 font-semibold">Select...</span>}
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
          const color = statusColor('second', value);
          return (
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => handleStartEdit(row.id, column.id, value)}>
              {value ? (typeof color === 'object' && 'custom' in color ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border" style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}>{value}</span> : <Badge color={color as any}>{value}</Badge>) : <span className="text-gray-700 font-semibold">Select...</span>}
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
          const color = statusColor('final', value);
          return (
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => handleStartEdit(row.id, column.id, value)}>
              {value ? (typeof color === 'object' && 'custom' in color ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border" style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}>{value}</span> : <Badge color={color as any}>{value}</Badge>) : <span className="text-gray-700 font-semibold">Select...</span>}
              <Edit3 size={12} className="opacity-0 group-hover:opacity-100 text-gray-400" />
            </div>
          );
        },
      }) as ColumnDef<Customer>,
    ];

    if (selectionMode) {
      cols.unshift({
        id: 'select',
        header: () => <span className="text-xs font-semibold text-gray-500">Sel</span>,
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
  }, [mode, editingCell, editValue, handleSaveEdit, handleCancelEdit, handleStartEdit, selectionMode, selectedIds, onToggleSelect, leadNumbers, localNumbered]);

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
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
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
