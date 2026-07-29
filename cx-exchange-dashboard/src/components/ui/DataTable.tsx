import React, { useMemo, useState } from 'react';
import { Icon } from './Icon';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
  /** 정렬 시 사용할 값. 지정하면 헤더 클릭으로 정렬 가능 */
  sortValue?: (row: T) => number | string | null;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  emptyMessage?: string;
  /** 지정 시 처음 maxRows만 보여주고 "더보기" 버튼 노출 */
  maxRows?: number;
  className?: string;
}

const ALIGN: Record<string, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  defaultSort,
  emptyMessage = '데이터가 없습니다.',
  maxRows,
  className = '',
}: DataTableProps<T>) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      // null은 항상 뒤로
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
  }, [rows, sort, columns]);

  const visible = maxRows && !expanded ? sorted.slice(0, maxRows) : sorted;

  const toggleSort = (col: Column<T>) => {
    if (!col.sortValue) return;
    setSort((prev) =>
      prev?.key === col.key ? { key: col.key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key: col.key, dir: 'desc' },
    );
  };

  return (
    <div className={className}>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => toggleSort(col)}
                className={`py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest ${
                  ALIGN[col.align ?? 'left']
                } ${col.sortValue ? 'cursor-pointer select-none hover:text-slate-600' : ''}`}
              >
                <span className="inline-flex items-center gap-0.5">
                  {col.header}
                  {sort?.key === col.key && (
                    <Icon name={sort.dir === 'desc' ? 'arrow_drop_down' : 'arrow_drop_up'} className="text-sm" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-slate-50 last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-slate-50 transition-colors' : ''
              }`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`py-3.5 px-3 text-xs font-bold text-slate-700 ${ALIGN[col.align ?? 'left']}`}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-slate-300 font-bold italic text-xs">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {maxRows && sorted.length > maxRows && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full mt-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
        >
          {expanded ? '접기' : `더보기 (${sorted.length - maxRows}건)`}
        </button>
      )}
    </div>
  );
}
