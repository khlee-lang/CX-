import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { bucketDateRange, computeLiveDrilldown, type Granularity, type ChannelGroup } from '../../lib/controlChart';
import { fetchExchangeHistoryDetail, type ExchangeHistoryDetail } from '../../api/exchangeHistoryDetail';
import type { ExchangeHistoryData } from '../../api/exchangeHistory';

export interface DrilldownTarget {
  bucket: string;
  granularity: Granularity;
  channelGroup: ChannelGroup;
  channelLabel: string;
  rate: number;
}

interface MergedDetail {
  totalCount: number;
  topProducts: { name: string; cnt: number }[];
  reasonDistribution: { reason: string; cnt: number }[];
}

const mergeCounts = <T extends string>(
  a: { key: T; cnt: number }[],
  b: { key: T; cnt: number }[],
): { key: T; cnt: number }[] => {
  const m = new Map<T, number>();
  [...a, ...b].forEach(({ key, cnt }) => m.set(key, (m.get(key) || 0) + cnt));
  return [...m.entries()].map(([key, cnt]) => ({ key, cnt })).sort((x, y) => y.cnt - x.cnt);
};

const mergeDetail = (a: MergedDetail, b: MergedDetail): MergedDetail => ({
  totalCount: a.totalCount + b.totalCount,
  topProducts: mergeCounts(
    a.topProducts.map((p) => ({ key: p.name, cnt: p.cnt })),
    b.topProducts.map((p) => ({ key: p.name, cnt: p.cnt })),
  ).slice(0, 5).map((p) => ({ name: p.key, cnt: p.cnt })),
  reasonDistribution: mergeCounts(
    a.reasonDistribution.map((r) => ({ key: r.reason, cnt: r.cnt })),
    b.reasonDistribution.map((r) => ({ key: r.reason, cnt: r.cnt })),
  ).slice(0, 8).map((r) => ({ reason: r.key, cnt: r.cnt })),
});

interface ControlChartDrilldownProps {
  target: DrilldownTarget;
  jasaRows: Record<string, any>[];
  oebuRows: Record<string, any>[];
  bulryangRows: Record<string, any>[];
  exchangeHistory: ExchangeHistoryData | null;
  onClose: () => void;
}

const GRANULARITY_LABEL: Record<Granularity, string> = { day: '일간', week: '주간', month: '월간' };

/**
 * 관제 그래프 밴드초과 지점 드릴다운 모달 — 클릭한 시점(일/주/월)의 실제 날짜 구간을 계산해
 * 과거 구간(BigQuery exchange_historical)과 라이브 구간(구글시트)을 필요에 따라 나눠 조회/병합한다.
 */
export const ControlChartDrilldown: React.FC<ControlChartDrilldownProps> = ({
  target, jasaRows, oebuRows, bulryangRows, exchangeHistory, onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MergedDetail | null>(null);

  const { start, end } = bucketDateRange(target.bucket, target.granularity);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    const historyMax = exchangeHistory?.coverage.maxDate ?? null;

    const run = async () => {
      try {
        let historical: ExchangeHistoryDetail | null = null;
        if (historyMax && start <= historyMax) {
          historical = await fetchExchangeHistoryDetail(start, historyMax < end ? historyMax : end, target.channelGroup);
        }

        let live: MergedDetail | null = null;
        if (!historyMax || end > historyMax) {
          const liveStart = historyMax && historyMax >= start ? addDays(historyMax, 1) : start;
          live = computeLiveDrilldown(jasaRows, oebuRows, bulryangRows, liveStart, end, target.channelGroup);
        }

        if (cancelled) return;
        if (historical && live) setDetail(mergeDetail(historical, live));
        else if (historical) setDetail(historical);
        else if (live) setDetail(live);
        else setDetail({ totalCount: 0, topProducts: [], reasonDistribution: [] });
      } catch (err: any) {
        if (!cancelled) setError(err.message || '조회 중 오류가 발생했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.bucket, target.granularity, target.channelGroup]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
              <Icon name="report_problem" className="text-xl" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                밴드초과 상세 · {target.channelLabel} {GRANULARITY_LABEL[target.granularity]}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {start === end ? start : `${start} ~ ${end}`} · 교환율 {target.rate.toFixed(2)}%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
          {loading && (
            <div className="text-center py-10 text-slate-400 text-sm font-bold">조회 중...</div>
          )}
          {error && (
            <div className="text-center py-10 text-rose-500 text-sm font-bold">{error}</div>
          )}
          {!loading && !error && detail && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">TOP 5 교환 발생 상품</p>
                {detail.topProducts.length === 0 ? (
                  <p className="text-sm text-slate-400 font-bold">해당 구간에 교환 데이터가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.topProducts.map((p, i) => (
                      <div key={p.name} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-black text-slate-300 w-4 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                          <span className="text-sm font-bold text-slate-700 truncate">{p.name}</span>
                        </div>
                        <span className="text-sm font-black text-indigo-600 flex-shrink-0 ml-2">{p.cnt}건</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                  같은 기간 불량 사유 분포 <span className="normal-case font-bold text-slate-300">(참고 — [불량] 교환 시트 기준)</span>
                </p>
                {detail.reasonDistribution.length === 0 ? (
                  <p className="text-sm text-slate-400 font-bold">해당 구간에 불량 접수가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.reasonDistribution.map((r) => (
                      <div key={r.reason} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700 truncate">{r.reason}</span>
                        <span className="text-sm font-black text-rose-500 flex-shrink-0 ml-2">{r.cnt}건</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
