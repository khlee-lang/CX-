import React from 'react';
import { RATE_BANDS, rateBand, type RateBand } from '../../lib/rate';

const BAND_CLASS: Record<RateBand['color'], string> = {
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  orange: 'bg-orange-50 text-orange-600',
  rose: 'bg-rose-50 text-rose-600',
};

export interface RateBadgeProps {
  /** 교환율(%). null = 출고 데이터 매칭 실패 */
  rate: number | null;
  /** 함께 넘기면 "(교환/출고)" 툴팁 표시 */
  exchanges?: number;
  shipped?: number | null;
  /** true → 표본부족 점선 배지 (색등급 미적용) */
  belowThreshold?: boolean;
  bands?: RateBand[];
  size?: 'sm' | 'md';
  /** 전기 대비 pp 변화 (▲0.3pp) */
  deltaPp?: number | null;
  className?: string;
}

export const RateBadge: React.FC<RateBadgeProps> = ({
  rate,
  exchanges,
  shipped,
  belowThreshold = false,
  bands = RATE_BANDS,
  size = 'sm',
  deltaPp,
  className = '',
}) => {
  const sizeCls = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const title =
    shipped != null && exchanges != null ? `교환 ${exchanges.toLocaleString()}건 / 출고 ${shipped.toLocaleString()}건` : undefined;

  if (rate === null) {
    return (
      <span className={`inline-flex items-center rounded-lg font-black bg-slate-100 text-slate-400 ${sizeCls} ${className}`}>
        —
      </span>
    );
  }

  if (belowThreshold) {
    return (
      <span
        title={title}
        className={`inline-flex items-center rounded-lg font-black border border-dashed border-slate-300 text-slate-400 ${sizeCls} ${className}`}
      >
        {rate.toFixed(1)}% <span className="ml-1 font-bold">표본부족</span>
      </span>
    );
  }

  const band = rateBand(rate, bands);
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-lg font-black ${BAND_CLASS[band.color]} ${sizeCls} ${className}`}
    >
      {rate.toFixed(1)}%
      {deltaPp != null && (
        <span className={`font-bold ${deltaPp > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
          {deltaPp > 0 ? '▲' : '▼'}
          {Math.abs(deltaPp).toFixed(1)}pp
        </span>
      )}
    </span>
  );
};
