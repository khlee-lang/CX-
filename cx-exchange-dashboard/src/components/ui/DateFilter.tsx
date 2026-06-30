import React from 'react';
import { Icon } from './Icon';

interface DateFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onApply?: () => void;
}

const toISO = (d: Date) => d.toISOString().split('T')[0];

export const DateFilter: React.FC<DateFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply
}) => {
  const today = new Date();

  const shortcuts = [
    {
      label: '오늘',
      onClick: () => {
        const t = toISO(today);
        onStartDateChange(t);
        onEndDateChange(t);
      },
    },
    {
      label: '어제',
      onClick: () => {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        const s = toISO(y);
        onStartDateChange(s);
        onEndDateChange(s);
      },
    },
    {
      label: '7일',
      onClick: () => {
        const s = new Date(today);
        s.setDate(s.getDate() - 6);
        onStartDateChange(toISO(s));
        onEndDateChange(toISO(today));
      },
    },
    {
      label: '30일',
      onClick: () => {
        const s = new Date(today);
        s.setDate(s.getDate() - 29);
        onStartDateChange(toISO(s));
        onEndDateChange(toISO(today));
      },
    },
  ];

  const getActiveShortcut = () => {
    const todayStr = toISO(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const d7 = new Date(today); d7.setDate(d7.getDate() - 6);
    const d30 = new Date(today); d30.setDate(d30.getDate() - 29);

    if (startDate === todayStr && endDate === todayStr) return '오늘';
    if (startDate === toISO(yesterday) && endDate === toISO(yesterday)) return '어제';
    if (startDate === toISO(d7) && endDate === todayStr) return '7일';
    if (startDate === toISO(d30) && endDate === todayStr) return '30일';
    return null;
  };

  const active = getActiveShortcut();

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low mb-6">
      <div className="flex items-center gap-2 shrink-0">
        <Icon name="calendar_today" className="text-primary text-lg" />
        <span className="text-sm font-bold text-slate-700">조회 기간 설정</span>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="bg-surface-container-low border-none rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary/20 font-medium"
        />
        <span className="text-slate-400 font-bold">~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="bg-surface-container-low border-none rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary/20 font-medium"
        />
      </div>

      {/* Shortcut buttons */}
      <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            onClick={s.onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all duration-200
              ${active === s.label
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
              }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {onApply && (
        <button
          onClick={onApply}
          className="ml-auto bg-primary text-white px-5 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all flex items-center gap-2"
        >
          <Icon name="filter_list" className="text-base" />
          필터 적용
        </button>
      )}
    </div>
  );
};
