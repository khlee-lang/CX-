import React from 'react';
import { Icon } from './Icon';

// Tailwind는 동적 클래스(`bg-${color}-500`)를 빌드에 포함하지 못하므로 고정 맵을 쓴다.
const ACCENT_BG: Record<string, string> = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  orange: 'bg-orange-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
};

export type KpiTone = 'default' | 'alert' | 'good' | 'accent';

const VALUE_COLOR: Record<KpiTone, string> = {
  default: 'text-slate-900',
  alert: 'text-rose-600',
  good: 'text-slate-900',
  accent: 'text-indigo-600',
};

export interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  detail?: React.ReactNode;
  /** stat = 큰 카드(호버 데코 원형), compact = 낮은 카드(운영지표 줄) */
  variant?: 'stat' | 'compact';
  tone?: KpiTone;
  trend?: { direction: 'up' | 'down'; text?: string };
  /** 데코 원형 색 (stat 전용) */
  accentColor?: keyof typeof ACCENT_BG;
  onClick?: () => void;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit,
  detail,
  variant = 'stat',
  tone = 'default',
  trend,
  accentColor = 'indigo',
  onClick,
  className = '',
}) => {
  const valueColor = VALUE_COLOR[tone];
  const clickable = onClick ? 'cursor-pointer' : '';

  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        className={`bg-white px-6 py-5 rounded-2xl shadow-sm border border-slate-100 ${clickable} ${className}`}
      >
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-2xl font-black ${valueColor}`}>
          {value}
          {unit && <span className="text-sm font-black ml-0.5">{unit}</span>}
        </p>
        {detail && <p className="text-[10px] font-bold text-slate-400 mt-1">{detail}</p>}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white p-7 rounded-[24px] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${clickable} ${className}`}
    >
      <div className="relative z-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
        <h3 className={`text-3xl font-black ${valueColor}`}>
          {value}
          {unit && <span className="text-base font-black ml-0.5">{unit}</span>}
        </h3>
        {(trend || detail) && (
          <div className="mt-4 flex items-center gap-1.5">
            {trend && (
              <Icon
                name={trend.direction === 'up' ? 'trending_up' : 'trending_down'}
                className={trend.direction === 'up' ? 'text-emerald-500' : 'text-rose-500'}
              />
            )}
            <span
              className={`text-[10px] font-black ${
                trend
                  ? trend.direction === 'up'
                    ? 'text-emerald-500'
                    : 'text-rose-500'
                  : 'text-slate-400'
              }`}
            >
              {trend?.text ?? detail}
            </span>
          </div>
        )}
      </div>
      <div
        className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700 ${ACCENT_BG[accentColor]}`}
      ></div>
    </div>
  );
};
