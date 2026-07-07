import React, { useState } from 'react';
import { Icon } from '../components/ui/Icon';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

type Status = 'idle' | 'loading' | 'preview' | 'applying' | 'done' | 'error';

interface CategoryResult {
  rowCount: number;
  distribution: Record<string, number>;
  applied: boolean;
}

interface ArchiveResult {
  totalGroups: number;
  archiveCount: number;
  partialGroups: number;
  partialRowCount: number;
  applied: boolean;
  pendingRemaining?: number;
  historyTotal?: number;
}

const CATEGORY_COLOR: Record<string, string> = {
  '반품': 'bg-slate-100 text-slate-700',
  '자사몰교환': 'bg-blue-100 text-blue-800',
  '외부몰교환': 'bg-purple-100 text-purple-700',
  '불량교환': 'bg-red-100 text-red-700',
};

export const ReturnsSheetMaintenance: React.FC = () => {
  // ── 구분값(E열) 재계산 ──────────────────────────────────────
  const [catStatus, setCatStatus] = useState<Status>('idle');
  const [catResult, setCatResult] = useState<CategoryResult | null>(null);
  const [catError, setCatError] = useState('');

  const runRecompute = async (apply: boolean) => {
    setCatStatus(apply ? 'applying' : 'loading');
    setCatError('');
    try {
      const res = await fetch(`${API_BASE_URL}/recompute-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`서버 응답 오류 (${res.status}): ${text.slice(0, 200)}`); }
      if (!res.ok) throw new Error(data.error || '서버 오류');
      setCatResult(data);
      setCatStatus(apply ? 'done' : 'preview');
    } catch (e: any) {
      setCatError(e.message);
      setCatStatus('error');
    }
  };

  // ── 완료건 → 히스토리 이관 ───────────────────────────────────
  const [arcStatus, setArcStatus] = useState<Status>('idle');
  const [arcResult, setArcResult] = useState<ArchiveResult | null>(null);
  const [arcError, setArcError] = useState('');

  const runArchive = async (apply: boolean) => {
    setArcStatus(apply ? 'applying' : 'loading');
    setArcError('');
    try {
      const res = await fetch(`${API_BASE_URL}/archive-completed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`서버 응답 오류 (${res.status}): ${text.slice(0, 200)}`); }
      if (!res.ok) throw new Error(data.error || '서버 오류');
      setArcResult(data);
      setArcStatus(apply ? 'done' : 'preview');
    } catch (e: any) {
      setArcError(e.message);
      setArcStatus('error');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">반품 시트 관리</h1>
        <p className="text-sm text-slate-500 mt-1">반품입고시트(판토스_입고리스트)를 가볍게 유지하기 위한 유지보수 도구입니다. 자동 실행되지 않으며, 필요할 때 수동으로 실행합니다.</p>
      </div>

      {/* ── 구분값 재계산 ────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">구분값(E열) 재계산</h2>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 flex gap-3 text-sm text-indigo-700 dark:text-indigo-300">
          <Icon name="info" className="mt-0.5 shrink-0" />
          <p>새 반품 건이 추가된 뒤 실행하면, 자사몰교환/외부몰교환/불량교환/반품 구분값을 다시 계산해서 E열에 채웁니다.</p>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={() => runRecompute(false)}
            disabled={catStatus === 'loading' || catStatus === 'applying'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {catStatus === 'loading'
              ? <><Icon name="sync" className="animate-spin text-base" /> 계산 중...</>
              : <><Icon name="search" className="text-base" /> 미리보기</>}
          </button>

          {catResult && catResult.rowCount > 0 && (['preview', 'done', 'applying'] as Status[]).includes(catStatus) && (
            <button
              onClick={() => runRecompute(true)}
              disabled={catStatus === 'done'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm disabled:opacity-40 transition-colors"
            >
              {catStatus === 'done'
                ? <><Icon name="check_circle" className="text-base" /> 반영 완료</>
                : <><Icon name="upload" className="text-base" /> 실제 반영 ({catResult.rowCount}행)</>}
            </button>
          )}
        </div>

        {catStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex gap-2">
            <Icon name="error" className="shrink-0 mt-0.5" />
            <span>{catError}</span>
          </div>
        )}

        {catResult && (catStatus === 'preview' || catStatus === 'done') && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="text-sm text-slate-500 mb-3">전체 {catResult.rowCount}행 {catStatus === 'done' ? '반영됨' : '계산됨'}</div>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(catResult.distribution).map(([label, count]) => (
                <div key={label} className={`px-3 py-2 rounded-lg text-sm font-semibold ${CATEGORY_COLOR[label] || 'bg-slate-100 text-slate-700'}`}>
                  {label}: {count}건
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="border-t border-slate-200 dark:border-slate-800" />

      {/* ── 완료건 이관 ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">완료건 → 히스토리 이관</h2>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 flex gap-3 text-sm text-indigo-700 dark:text-indigo-300">
          <Icon name="info" className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>같은 주문번호 그룹의 완료일이 <span className="font-bold">모두</span> 날짜로 채워진 경우에만 판토스_입고_히스토리 탭으로 이관합니다.</p>
            <p className="text-indigo-500 dark:text-indigo-400">하나라도 비어있거나 "확인필요" 등 날짜가 아니면 그룹 전체가 미처리함에 남습니다.</p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={() => runArchive(false)}
            disabled={arcStatus === 'loading' || arcStatus === 'applying'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {arcStatus === 'loading'
              ? <><Icon name="sync" className="animate-spin text-base" /> 확인 중...</>
              : <><Icon name="search" className="text-base" /> 미리보기</>}
          </button>

          {arcResult && arcResult.archiveCount > 0 && (['preview', 'done', 'applying'] as Status[]).includes(arcStatus) && (
            <button
              onClick={() => runArchive(true)}
              disabled={arcStatus === 'done'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm disabled:opacity-40 transition-colors"
            >
              {arcStatus === 'done'
                ? <><Icon name="check_circle" className="text-base" /> 이관 완료</>
                : <><Icon name="upload" className="text-base" /> 이관 실행 ({arcResult.archiveCount}행)</>}
            </button>
          )}
        </div>

        {arcStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex gap-2">
            <Icon name="error" className="shrink-0 mt-0.5" />
            <span>{arcError}</span>
          </div>
        )}

        {arcResult && (arcStatus === 'preview' || arcStatus === 'done') && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[140px] bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-emerald-600">{arcResult.archiveCount}</div>
              <div className="text-xs text-emerald-700 font-semibold mt-1">이관 {arcStatus === 'done' ? '완료' : '대상'}</div>
            </div>
            <div className="flex-1 min-w-[140px] bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-amber-600">{arcResult.partialRowCount}</div>
              <div className="text-xs text-amber-700 font-semibold mt-1">부분완료 보류 ({arcResult.partialGroups}그룹)</div>
            </div>
            {arcStatus === 'done' && (
              <>
                <div className="flex-1 min-w-[140px] bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                  <div className="text-3xl font-black text-slate-600">{arcResult.pendingRemaining}</div>
                  <div className="text-xs text-slate-500 font-semibold mt-1">미처리함 남은 행</div>
                </div>
                <div className="flex-1 min-w-[140px] bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 text-center">
                  <div className="text-3xl font-black text-indigo-600">{arcResult.historyTotal}</div>
                  <div className="text-xs text-indigo-700 font-semibold mt-1">히스토리 전체</div>
                </div>
              </>
            )}
          </div>
        )}

        {arcResult && arcResult.archiveCount === 0 && (arcStatus === 'preview' || arcStatus === 'done') && (
          <div className="text-center py-8 text-slate-400 text-sm">
            <Icon name="check_circle" className="text-4xl text-emerald-400 block mx-auto mb-2" />
            이관할 완료 건이 없습니다.
          </div>
        )}
      </section>
    </div>
  );
};
