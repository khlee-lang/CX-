import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Icon } from '../components/ui/Icon';
import { transformReturnizeRows, type ReturnizeRow, type ReturnizeSourceRow } from '../lib/returnizeTransform';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

type Status = 'idle' | 'parsed' | 'applying' | 'done' | 'error';

// ── 구분값(C열) 재계산 ────────────────────────────────────────────
// 리터니즈 업로드 시 자동으로 한 번 계산되지만, 업로드 없이(예: 교환접수시트
// 쪽 데이터가 나중에 바뀐 경우) 다시 계산하고 싶을 때를 위한 독립 버튼.
type RecomputeStatus = 'idle' | 'loading' | 'preview' | 'applying' | 'done' | 'error';

interface RecomputeResult {
  rowCount: number;
  distribution: Record<string, number>;
  applied: boolean;
  warnings?: string[];
}

const CATEGORY_COLOR: Record<string, string> = {
  자사몰교환: 'bg-emerald-100 text-emerald-700',
  외부몰교환: 'bg-blue-100 text-blue-700',
  불량교환: 'bg-red-100 text-red-700',
  반품: 'bg-slate-100 text-slate-700',
};

const RecomputeSection: React.FC = () => {
  const [status, setStatus] = useState<RecomputeStatus>('idle');
  const [result, setResult] = useState<RecomputeResult | null>(null);
  const [error, setError] = useState('');

  const run = async (apply: boolean) => {
    setStatus(apply ? 'applying' : 'loading');
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/recompute-returnize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply }),
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

  return (
    <section className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">구분값(C열) 재계산</h2>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 flex gap-3 text-sm text-indigo-700 dark:text-indigo-300">
        <Icon name="info" className="mt-0.5 shrink-0" />
        <p>업로드 없이 리터니즈 시트 전체 구분값(자사몰교환/외부몰교환/불량교환/반품)을 다시 계산하고 싶을 때 실행합니다. (리터니즈 시트 전용)</p>
      </div>

      <div className="flex gap-3 items-center">
        <button
          onClick={() => run(false)}
          disabled={status === 'loading' || status === 'applying'}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
        >
          {status === 'loading'
            ? <><Icon name="sync" className="animate-spin text-base" /> 계산 중...</>
            : <><Icon name="search" className="text-base" /> 미리보기</>}
        </button>

        {result && result.rowCount > 0 && (['preview', 'done', 'applying'] as RecomputeStatus[]).includes(status) && (
          <button
            onClick={() => run(true)}
            disabled={status === 'done'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm disabled:opacity-40 transition-colors"
          >
            {status === 'done'
              ? <><Icon name="check_circle" className="text-base" /> 반영 완료</>
              : <><Icon name="upload" className="text-base" /> 실제 반영 ({result.rowCount}행)</>}
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
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-500 mb-3">전체 {result.rowCount}행 {status === 'done' ? '반영됨' : '계산됨'}</div>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(result.distribution).map(([label, count]) => (
              <div key={label} className={`px-3 py-2 rounded-lg text-sm font-semibold ${CATEGORY_COLOR[label] || 'bg-slate-100 text-slate-700'}`}>
                {label}: {count}건
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

function readSourceExcel(file: File): Promise<ReturnizeSourceRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target?.result;
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const rows: ReturnizeSourceRow[] = json.map(r => ({
          브랜드주문번호: String(r['브랜드 주문번호'] ?? ''),
          고객명: String(r['고객명'] ?? ''),
          연락처: String(r['연락처'] ?? ''),
          접수채널명: String(r['접수 채널명'] ?? ''),
          주문번호: String(r['주문번호'] ?? ''),
          상품명: String(r['상품명'] ?? ''),
          옵션: String(r['옵션'] ?? ''),
          송장번호: String(r['송장번호'] ?? ''),
          아이템순번: r['아이템 순번'] ?? '',
          상태: String(r['상태'] ?? ''),
          검품제품상태: String(r['검품 제품 상태'] ?? ''),
          검품내용물상태: String(r['검품 내용물 상태'] ?? ''),
          훼손사유: String(r['훼손 사유'] ?? ''),
          수량: r['수량'] ?? '',
        }));
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export const ReturnizeUpload: React.FC = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ReturnizeRow[]>([]);
  const [reviewEdits, setReviewEdits] = useState<Record<number, string>>({});
  const [fileName, setFileName] = useState('');
  const [insertedCount, setInsertedCount] = useState(0);
  const [categoryDistribution, setCategoryDistribution] = useState<Record<string, number> | null>(null);

  const handleFile = async (file: File) => {
    setError('');
    setFileName(file.name);
    try {
      const source = await readSourceExcel(file);
      const transformed = transformReturnizeRows(source, new Date());
      setRows(transformed);
      setReviewEdits({});
      setStatus('parsed');
    } catch (e: any) {
      setError(e.message || '엑셀 파일을 읽는 중 오류가 발생했습니다.');
      setStatus('error');
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const needsReviewIndexes = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === 'needsReview')
    .map(({ i }) => i);

  const allReviewFilled = needsReviewIndexes.every(i => (reviewEdits[i] || '').trim().length > 0);
  const okCount = rows.filter(r => r.status === 'ok').length;

  const submit = async () => {
    if (!allReviewFilled) return;
    setStatus('applying');
    setError('');
    try {
      const finalRows = rows.map((r, i) => ({
        ...r,
        상품명옵션명: r.status === 'needsReview' ? reviewEdits[i] : r.상품명옵션명,
      }));
      const res = await fetch(`${API_BASE_URL}/upload-returnize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: finalRows }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`서버 응답 오류 (${res.status}): ${text.slice(0, 200)}`); }
      if (!res.ok) throw new Error(data.error || '서버 오류');
      setInsertedCount(data.insertedCount ?? finalRows.length);
      setCategoryDistribution(data.category?.distribution ?? null);
      setStatus('done');
    } catch (e: any) {
      setError(e.message);
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setRows([]);
    setReviewEdits({});
    setError('');
    setFileName('');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">리터니즈 반품 업로드</h1>
        <p className="text-sm text-slate-500 mt-1">리터니즈에서 다운로드한 "주문 조회 결과" 엑셀을 업로드하면 리터니즈 워크시트 양식에 맞춰 변환 후 반영합니다.</p>
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 flex gap-3 text-sm text-indigo-700 dark:text-indigo-300">
        <Icon name="info" className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>검품 제품 상태가 "제품 없음" 또는 "타사 제품"인 행은 자동으로 제외됩니다.</p>
          <p className="text-indigo-500 dark:text-indigo-400">옵션 형식이 "제품코드 | 색상 | 사이즈" 3파트 또는 "색상-사이즈" 형태가 아니면 "확인필요"로 분류되며, 직접 상품명/옵션명을 입력해야 반영할 수 있습니다.</p>
        </div>
      </div>

      {status === 'idle' && (
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 cursor-pointer hover:border-indigo-400 transition-colors">
          <Icon name="upload_file" className="text-4xl text-slate-400" />
          <span className="text-sm text-slate-500">엑셀 파일(.xlsx)을 선택하세요</span>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
        </label>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex gap-2">
          <Icon name="error" className="shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={reset} className="ml-auto underline shrink-0">다시 시도</button>
        </div>
      )}

      {(status === 'parsed' || status === 'applying') && (
        <div className="space-y-5">
          <div className="flex gap-3 items-center text-sm text-slate-500">
            <Icon name="description" className="text-base" />
            <span>{fileName}</span>
            <button onClick={reset} className="ml-auto text-indigo-600 underline text-xs">다른 파일 선택</button>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-emerald-600">{okCount}</div>
              <div className="text-xs text-emerald-700 font-semibold mt-1">자동 변환 완료</div>
            </div>
            <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-amber-600">{needsReviewIndexes.length}</div>
              <div className="text-xs text-amber-700 font-semibold mt-1">확인필요</div>
            </div>
          </div>

          <div>
            <button
              onClick={submit}
              disabled={!allReviewFilled || status === 'applying'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm disabled:opacity-40 transition-colors"
            >
              {status === 'applying'
                ? <><Icon name="sync" className="animate-spin text-base" /> 반영 중...</>
                : <><Icon name="upload" className="text-base" /> 구글시트에 반영 ({rows.length}행)</>}
            </button>
            {!allReviewFilled && needsReviewIndexes.length > 0 && (
              <p className="text-xs text-amber-600 mt-2">확인필요 항목을 모두 입력해야 반영할 수 있습니다.</p>
            )}
            {status === 'applying' && (
              <div className="mt-3 max-w-sm">
                <div className="relative h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 overflow-hidden">
                  <div className="absolute top-0 h-full rounded-full bg-emerald-500 animate-indeterminate-bar" />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">시트에 행 추가 + 구분값 자동계산까지 진행 중입니다...</p>
              </div>
            )}
          </div>

          {needsReviewIndexes.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">확인필요 — 상품명/옵션명 직접 입력</h2>
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 dark:bg-amber-900/20 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2.5 text-left">주문번호</th>
                      <th className="px-4 py-2.5 text-left">원본 상품명 / 옵션</th>
                      <th className="px-4 py-2.5 text-left">상품명/옵션명 입력</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-50 dark:divide-amber-900/20">
                    {needsReviewIndexes.map(i => {
                      const r = rows[i];
                      return (
                        <tr key={i}>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-800 dark:text-slate-200">{r.주문번호}</td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">{r.원본상품명} / {r.원본옵션}</td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              defaultValue={`${r.원본상품명} [${r.원본옵션}]`}
                              onChange={(e) => setReviewEdits(prev => ({ ...prev, [i]: e.target.value }))}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {okCount > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">자동 변환 완료 미리보기</h2>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2.5 text-left">주문번호</th>
                      <th className="px-4 py-2.5 text-left">성함</th>
                      <th className="px-4 py-2.5 text-left">판매처</th>
                      <th className="px-4 py-2.5 text-left">상품명/옵션명</th>
                      <th className="px-4 py-2.5 text-left">실수량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.filter(r => r.status === 'ok').map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-800 dark:text-slate-200">{r.주문번호}</td>
                        <td className="px-4 py-2.5 text-xs">{r.성함}</td>
                        <td className="px-4 py-2.5 text-xs">{r.판매처}</td>
                        <td className="px-4 py-2.5 text-xs">{r.상품명옵션명}</td>
                        <td className="px-4 py-2.5 text-xs">{r.실수량}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'done' && (
        <div className="space-y-4">
          <div className="text-center py-10 text-emerald-600">
            <Icon name="check_circle" className="text-4xl block mx-auto mb-2" />
            <p className="font-bold">{insertedCount}행이 리터니즈 시트에 반영되었습니다.</p>
          </div>

          {categoryDistribution && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-sm text-slate-500 mb-3">구분값도 자동으로 재계산됐습니다 (리터니즈 시트 전체 기준)</div>
              <div className="flex gap-3 flex-wrap justify-center">
                {Object.entries(categoryDistribution).map(([label, count]) => (
                  <div key={label} className="px-3 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    {label}: {count}건
                  </div>
                ))}
              </div>
            </div>
          )}
          {categoryDistribution === null && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm text-center">
              구분값 자동 재계산에 실패했습니다 — 아래 "구분값(C열) 재계산"에서 수동으로 다시 실행해주세요.
            </div>
          )}

          <button onClick={reset} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-semibold text-sm mx-auto">
            <Icon name="upload_file" className="text-base" /> 새 파일 업로드
          </button>
        </div>
      )}

      <RecomputeSection />
    </div>
  );
};
