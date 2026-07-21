import React, { useState } from 'react';
import { Icon } from './ui/Icon';

// 반품-교환 연동 섹션 — 판토스/리터니즈 두 반품시트에서 공용으로 쓴다.
// source prop만 다르게 주면 백엔드가 해당 반품시트를 읽고 완료일을 기입한다.
// (교환접수시트 [자사몰]/[외부몰] 교환은 두 채널 공통)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export type ReconcileSource = '판토스' | '리터니즈';

type Status = 'idle' | 'loading' | 'preview' | 'applying' | 'done' | 'error';

type Category = '자사몰교환' | '외부몰교환';
const CATEGORY_TABS: { key: Category; label: string }[] = [
  { key: '자사몰교환', label: '자사몰' },
  { key: '외부몰교환', label: '외부몰' },
];

interface Action {
  order_no: string;
  exchange_rows: number[];
  return_rows: number[];
  ship_date: string;
  done_date: string;
  reason: string;
}

interface Issue {
  order_no: string;
  issue_type: string;
  description: string;
  return_rows?: number[];
  exchange_rows?: number[];
}

interface ReconcileResult {
  actions: Action[];
  issues: Issue[];
  applied: { excUpdated: number; retUpdated: number } | null;
  today: string;
}

const ISSUE_TYPE_COLOR: Record<string, string> = {
  '주문없음':        'bg-yellow-100 text-yellow-800',
  '상품불일치':      'bg-red-100 text-red-700',
  '카테고리혼재':    'bg-pink-100 text-pink-700',
  '지불방법혼재':    'bg-orange-100 text-orange-700',
  '알수없는지불방법':'bg-purple-100 text-purple-700',
};

const SOURCE_SHEET_LABEL: Record<ReconcileSource, string> = {
  '판토스': '판토스_입고리스트',
  '리터니즈': '리터니즈 시트',
};

export const ReconcileSection: React.FC<{ source?: ReconcileSource }> = ({ source = '판토스' }) => {
  const [category, setCategory] = useState<Category>('자사몰교환');
  const [status, setStatus]   = useState<Status>('idle');
  const [result, setResult]   = useState<ReconcileResult | null>(null);
  const [error, setError]     = useState<string>('');

  const switchCategory = (cat: Category) => {
    if (cat === category) return;
    setCategory(cat);
    setStatus('idle');
    setResult(null);
    setError('');
  };

  const run = async (apply: boolean) => {
    setStatus(apply ? 'applying' : 'loading');
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply, category, source }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`서버 응답 오류 (${res.status}): ${text.slice(0, 200)}`); }
      if (!res.ok) throw new Error(data.error || '서버 오류');
      setResult(data);
      setStatus(apply ? 'done' : 'preview');
    } catch (e: any) {
      setError(e.message);
      setStatus('error');
    }
  };

  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">반품-교환 연동</h2>
      <p className="text-sm text-slate-500 -mt-2">{SOURCE_SHEET_LABEL[source]}의 미처리 {category} 건을 교환접수시트와 대조해 출고일·확인완료일을 자동 기입합니다.</p>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => switchCategory(tab.key)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors ${
              category === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 flex gap-3 text-sm text-indigo-700 dark:text-indigo-300">
        <Icon name="info" className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p><span className="font-bold">미리보기</span>를 먼저 실행해 결과를 확인한 뒤, 이상 없으면 <span className="font-bold">시트에 반영</span>하세요.</p>
          <p className="text-indigo-500 dark:text-indigo-400">기준일: {today}</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <button
          onClick={() => run(false)}
          disabled={status === 'loading' || status === 'applying'}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
        >
          {status === 'loading'
            ? <><Icon name="sync" className="animate-spin text-base" /> 읽는 중...</>
            : <><Icon name="search" className="text-base" /> 미리보기 실행</>}
        </button>

        {result && result.actions.length > 0 && (['preview', 'done', 'applying'] as Status[]).includes(status) && (
          <button
            onClick={() => run(true)}
            disabled={status === 'done'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm disabled:opacity-40 transition-colors"
          >
            {status === 'done'
              ? <><Icon name="check_circle" className="text-base" /> 반영 완료</>
              : <><Icon name="upload" className="text-base" /> 시트에 반영 ({result.actions.length}건)</>}
          </button>
        )}
      </div>

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex gap-2">
          <Icon name="error" className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (status === 'preview' || status === 'done') && (
        <div className="space-y-5">
          <div className="flex gap-3">
            <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-emerald-600">{result.actions.length}</div>
              <div className="text-xs text-emerald-700 font-semibold mt-1">정상 처리</div>
            </div>
            <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-red-500">{result.issues.length}</div>
              <div className="text-xs text-red-600 font-semibold mt-1">이슈</div>
            </div>
            {status === 'done' && result.applied && (
              <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 text-center">
                <div className="text-3xl font-black text-indigo-600">{result.applied.excUpdated + result.applied.retUpdated}</div>
                <div className="text-xs text-indigo-700 font-semibold mt-1">셀 업데이트</div>
              </div>
            )}
          </div>

          {result.actions.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">정상 처리 예정</h3>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2.5 text-left">주문번호</th>
                      <th className="px-4 py-2.5 text-left">출고일</th>
                      <th className="px-4 py-2.5 text-left">확인완료일</th>
                      <th className="px-4 py-2.5 text-left">사유</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {result.actions.map((a) => (
                      <tr key={a.order_no} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-800 dark:text-slate-200">{a.order_no}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.ship_date.startsWith('입고') ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                            {a.ship_date}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 text-xs">{a.done_date}</td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">{a.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.issues.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">이슈 (수동 확인 필요)</h3>
              <div className="rounded-xl border border-red-100 dark:border-red-900/40 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 dark:bg-red-900/20 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2.5 text-left">주문번호</th>
                      <th className="px-4 py-2.5 text-left">유형</th>
                      <th className="px-4 py-2.5 text-left">내용</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50 dark:divide-red-900/20">
                    {result.issues.map((iss) => (
                      <tr key={iss.order_no} className="hover:bg-red-50/50 dark:hover:bg-red-900/10">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-800 dark:text-slate-200">{iss.order_no}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ISSUE_TYPE_COLOR[iss.issue_type] || 'bg-slate-100 text-slate-700'}`}>
                            {iss.issue_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">{iss.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.actions.length === 0 && result.issues.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              <Icon name="check_circle" className="text-4xl text-emerald-400 block mx-auto mb-2" />
              처리할 건이 없습니다.
            </div>
          )}
        </div>
      )}
    </section>
  );
};
