import React from 'react';
import { MIN_SHIPPED_OPTIONS } from '../../lib/rate';

export interface MinShipmentFilterProps {
  value: number;
  onChange: (v: number) => void;
  options?: number[];
  className?: string;
}

/** 소량 출고 상품의 교환율 왜곡 방지용 최소 출고량 세그먼트 필터 */
export const MinShipmentFilter: React.FC<MinShipmentFilterProps> = ({
  value,
  onChange,
  options = MIN_SHIPPED_OPTIONS,
  className = '',
}) => (
  <div className={`flex items-center gap-1 ${className}`}>
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">출고</span>
    {options.map((opt) => (
      <button
        key={opt}
        onClick={() => onChange(opt)}
        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-colors ${
          value === opt ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
      >
        {opt === 0 ? '전체' : `${opt}+`}
      </button>
    ))}
  </div>
);
