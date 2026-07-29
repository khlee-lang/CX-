import React, { useState } from 'react';
import { Icon } from './Icon';
import type { MatchCoverage } from '../../lib/rate';

export interface MatchCoverageChipProps {
  coverage: MatchCoverage | null;
  /** 출고 데이터 조회 실패 시 true → 실패 배너 칩 */
  failed?: boolean;
  className?: string;
}

/**
 * 교환 데이터 ↔ 출고 데이터 매칭 상태 칩.
 * 매칭 실패를 숨기지 않고 노출한다 — 클릭 시 미매칭 상품명 목록 팝오버.
 */
export const MatchCoverageChip: React.FC<MatchCoverageChipProps> = ({ coverage, failed = false, className = '' }) => {
  const [open, setOpen] = useState(false);

  if (failed) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 text-[10px] font-black ${className}`}
      >
        <Icon name="cloud_off" className="text-sm" />
        출고 데이터를 불러오지 못했습니다 — 교환율 지표 비활성
      </span>
    );
  }

  if (!coverage) return null;
  const total = coverage.matched + coverage.unmatched;
  if (total === 0) return null;
  const pct = ((coverage.unmatched / total) * 100).toFixed(1);

  if (coverage.unmatched === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-black ${className}`}
      >
        <Icon name="check_circle" className="text-sm" />
        출고 매칭 100%
      </span>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black hover:bg-slate-200 transition-colors"
      >
        <Icon name="link_off" className="text-sm" />
        출고 매칭 실패 {coverage.unmatched.toLocaleString()}건 ({pct}%)
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-5 z-50">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">미매칭 상품 (교환건수 순)</p>
            <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-500">
              <Icon name="close" className="text-sm" />
            </button>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mb-3 leading-relaxed">
            사은품·세트·굿즈 등 출고 테이블에 없는 품목이 대부분입니다. 이 상품들은 건수 지표에는 포함되고 교환율
            지표에서만 제외됩니다.
          </p>
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {coverage.unmatchedNames.slice(0, 30).map((u, i) => (
              <div key={i} className="flex justify-between gap-3 text-[11px] font-bold">
                <span className="text-slate-600 truncate">{u.name}</span>
                <span className="text-slate-400 shrink-0">{u.count}건</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
