import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { KpiCard } from '../components/ui/KpiCard';
import { DataTable, type Column } from '../components/ui/DataTable';
import { RateBadge } from '../components/ui/RateBadge';
import { useDashboardData } from '../hooks/useDashboardData';
import { useShipments } from '../hooks/useShipments';
import { FeedbackProvider, FeedbackSection, FeedbackButton } from '../components/feedback/FeedbackSystem';
import { fetchShipments, type ShipmentData } from '../api/shipments';
import { isJasaScopedChannel, lookupProduct } from '../lib/rate';
import { toISODate } from '../lib/exchange';
import {
  buildSalesMatrix,
  addDays,
  recentWeeks,
  weekLabel,
  weekTitle,
  LIVE_EXCHANGE_MIN_DATE,
} from '../lib/salesView';

const WEEKLY_MIN_SHIPPED_OPTIONS = [50, 100, 300, 500];
const WEEKLY_MIN_SHIPPED_DEFAULT = 50;
const HEATMAP_MAX_PRODUCTS = 20;

// 히트맵 색칠 기준 — 랭킹 정렬은 테이블 헤더 클릭으로 하므로 히트맵만 별도 토글을 둔다
type HeatBasis = 'rate' | 'count';

interface RankingRow {
  name: string;
  count: number;
  shipped: number | null;
  rate: number | null;
  belowThreshold: boolean;
  deltaPp: number | null; // 전주 대비 교환율 변화
  spark: (number | null)[]; // 조회창 전체 주차 교환율
}

const Sparkline: React.FC<{ values: (number | null)[] }> = ({ values }) => {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return <span className="text-[10px] text-slate-300">—</span>;
  const max = Math.max(...nums, 0.001);
  const W = 96;
  const H = 24;
  const step = W / (values.length - 1);
  const pts = values
    .map((v, i) => (v == null ? null : `${(i * step).toFixed(1)},${(H - (v / max) * (H - 4) - 2).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');
  return (
    <svg width={W} height={H} className="inline-block align-middle">
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

export const SalesView: React.FC = () => {
  const { data: exchangeData, loading, reload } = useDashboardData('jasaMall');
  const [shipments, setShipments] = useState<ShipmentData | null>(null);
  const [shipFailed, setShipFailed] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weeks = useMemo(() => recentWeeks(todayStr), [todayStr]);
  const currentWeek = weeks[weeks.length - 1];
  const completeWeeks = weeks.slice(0, -1);

  // 기본 선택: 최근 완결 주 (이번 주는 "집계 중"이라 헤드라인으로 부적합)
  const [selectedWeek, setSelectedWeek] = useState(() => completeWeeks[completeWeeks.length - 1] ?? currentWeek);
  const [heatBasis, setHeatBasis] = useState<HeatBasis>('rate');
  const [minShipped, setMinShipped] = useState(WEEKLY_MIN_SHIPPED_DEFAULT);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ── 자유 기간(달력) 모드 — 설정되면 주차 모드 대신 이 기간으로 KPI·랭킹 집계 ──
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(LIVE_EXCHANGE_MIN_DATE);
  const [draftEnd, setDraftEnd] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const data = await fetchShipments(weeks[0], todayStr, false, true);
      if (cancelled) return;
      setShipments(data);
      setShipFailed(data === null);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [weeks, todayStr]);

  const matrix = useMemo(
    () =>
      buildSalesMatrix(
        exchangeData?.data.jasaMall || [],
        exchangeData?.data.oebuMall || [],
        shipments?.byProductWeek,
        weeks,
      ),
    [exchangeData, shipments, weeks],
  );

  // 자유 기간 분모: 기간 합계 출고(byProduct)를 별도 조회 — 주 단위로 못 쪼개는
  // 임의 구간도 정확한 기간 출고량으로 계산된다.
  const customShip = useShipments(customRange?.start, customRange?.end);

  // ── 자유 기간 집계 (customRange 있을 때만) ──────────────────
  const customStats = useMemo(() => {
    if (!customRange || !exchangeData) return null;
    const { start, end } = customRange;
    const inRange = (r: Record<string, any>) => {
      const d = toISODate(r['접수일']);
      return d != null && d >= start && d <= end;
    };
    const counts = new Map<string, number>();
    let total = 0;
    const bump = (r: Record<string, any>) => {
      total += 1;
      const name = (r['상품명'] || '').trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    };
    (exchangeData.data.jasaMall || []).filter(inRange).forEach(bump);
    (exchangeData.data.oebuMall || []).filter((r) => isJasaScopedChannel(r['채널명']) && inRange(r)).forEach(bump);

    const idx = customShip.index;
    const shippedTotal = idx?.total.jasa ?? 0;
    const products = [...counts.entries()].map(([name, count]) => {
      const shipped = idx ? lookupProduct(idx, name)?.jasa ?? null : null;
      return { name, count, shipped, rate: shipped ? (count / shipped) * 100 : null };
    });
    return {
      total,
      shippedTotal,
      rate: shippedTotal > 0 ? (total / shippedTotal) * 100 : null,
      products,
    };
  }, [customRange, exchangeData, customShip.index]);

  // ── 선택 주 KPI ──────────────────────────────────────────────
  const kpi = useMemo(() => {
    const cur = matrix.weekTotals[selectedWeek] ?? { exchangeCnt: 0, shipped: 0 };
    const prevWeek = addDays(selectedWeek, -7);
    const prev = matrix.weekTotals[prevWeek];
    const rate = cur.shipped > 0 ? (cur.exchangeCnt / cur.shipped) * 100 : null;
    const prevRate = prev && prev.shipped > 0 ? (prev.exchangeCnt / prev.shipped) * 100 : null;
    return {
      ...cur,
      rate,
      deltaPp: rate != null && prevRate != null ? rate - prevRate : null,
      hasPrev: !!prev,
    };
  }, [matrix, selectedWeek]);

  // ── 워스트 랭킹 (선택 주 또는 자유 기간) ─────────────────────
  const ranking = useMemo((): RankingRow[] => {
    const sparkOf = (name: string) => {
      const mr = matrix.rows.find((r) => r.name === name);
      return matrix.weeks.map((w) => mr?.cells[w]?.rate ?? null);
    };

    const prevWeek = addDays(selectedWeek, -7);
    const rows: RankingRow[] = customStats
      ? customStats.products.map((p) => ({
          name: p.name,
          count: p.count,
          shipped: p.shipped,
          rate: p.rate,
          belowThreshold: (p.shipped ?? 0) < minShipped,
          deltaPp: null, // 자유 기간은 "전주" 개념이 없음
          spark: sparkOf(p.name),
        }))
      : matrix.rows
          .map((r) => {
            const cell = r.cells[selectedWeek];
            const prevCell = r.cells[prevWeek];
            return {
              name: r.name,
              count: cell?.exchangeCnt ?? 0,
              shipped: cell?.shipped ?? null,
              rate: cell?.rate ?? null,
              belowThreshold: (cell?.shipped ?? 0) < minShipped,
              deltaPp:
                cell?.rate != null && prevCell?.rate != null ? cell.rate - prevCell.rate : null,
              spark: matrix.weeks.map((w) => r.cells[w]?.rate ?? null),
            };
          })
          .filter((r) => r.count > 0);

    // 정렬은 테이블 헤더 클릭(DataTable)에 맡기고, 여기서는 소표본만 걸러낸다.
    // 출고 임계값 미만은 교환율이 튀어서(출고 3건에 교환 2건=66%) 랭킹을 오염시킨다.
    return rows.filter((r) => !r.belowThreshold);
  }, [matrix, selectedWeek, minShipped, customStats]);

  // ── 히트맵 (교환 총량 상위 상품 × 주차) ──────────────────────
  const heatmap = useMemo(() => {
    const rows = matrix.rows.slice(0, HEATMAP_MAX_PRODUCTS);
    let max = 0;
    rows.forEach((r) =>
      matrix.weeks.forEach((w) => {
        const v = heatBasis === 'rate' ? r.cells[w]?.rate ?? 0 : r.cells[w]?.exchangeCnt ?? 0;
        if (v > max) max = v;
      }),
    );
    return { rows, max: max || 1 };
  }, [matrix, heatBasis]);

  // ── 드릴다운 (상품 선택 시, 조회창 전체) ─────────────────────
  const drilldown = useMemo(() => {
    if (!selectedProduct || !exchangeData) return null;
    const windowStart = weeks[0];
    const inWindow = (r: Record<string, any>) => {
      const d = toISODate(r['접수일']);
      return d != null && d >= windowStart && (r['상품명'] || '').trim() === selectedProduct;
    };
    const rows = [
      ...(exchangeData.data.jasaMall || []).filter(inWindow),
      ...(exchangeData.data.oebuMall || []).filter((r) => isJasaScopedChannel(r['채널명']) && inWindow(r)),
    ];
    const fromMap = new Map<string, number>();
    const swapMap = new Map<string, number>();
    rows.forEach((r) => {
      const from = (r['교환 전 옵션'] || '').trim() || '미지정';
      const to = (r['교환 출고 옵션'] || '').trim() || '미지정';
      fromMap.set(from, (fromMap.get(from) || 0) + 1);
      swapMap.set(`${from} → ${to}`, (swapMap.get(`${from} → ${to}`) || 0) + 1);
    });
    const top = (m: Map<string, number>, n: number) =>
      [...m.entries()].map(([key, cnt]) => ({ key, cnt })).sort((a, b) => b.cnt - a.cnt).slice(0, n);
    const productRow = matrix.rows.find((r) => r.name === selectedProduct) ?? null;
    return { total: rows.length, topFrom: top(fromMap, 8), topSwap: top(swapMap, 5), productRow };
  }, [selectedProduct, exchangeData, weeks, matrix]);

  const columns = useMemo((): Column<RankingRow>[] => [
    {
      key: 'name', header: '상품', sortValue: (r) => r.name,
      render: (r) => <span className="font-black text-slate-700">{r.name}</span>,
    },
    {
      key: 'count', header: '교환건수', align: 'right', sortValue: (r) => r.count,
      render: (r) => <span className="font-black text-slate-600">{r.count}건</span>,
    },
    {
      key: 'shipped', header: customRange ? '기간 출고' : '주간 출고', align: 'right', sortValue: (r) => r.shipped,
      render: (r) => <span className="font-bold text-slate-400">{r.shipped?.toLocaleString() ?? '—'}</span>,
    },
    {
      key: 'rate', header: '교환율', align: 'right', sortValue: (r) => r.rate,
      render: (r) => (
        <RateBadge rate={r.rate} exchanges={r.count} shipped={r.shipped} belowThreshold={r.belowThreshold} deltaPp={r.deltaPp} />
      ),
    },
    {
      key: 'spark', header: `추이 (${matrix.weeks.length}주)`, align: 'right',
      render: (r) => <Sparkline values={r.spark} />,
    },
  ], [matrix.weeks.length, customRange]);

  if (loading && !exchangeData) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-indigo-600 font-black animate-pulse">
        세일즈 뷰 준비 중...
      </div>
    );
  }

  return (
    <FeedbackProvider>
    <div className="min-h-screen bg-slate-50">
      {/* 세일즈팀 전용 화면 — CX 운영 사이드바 없이 독립 헤더만 둔다 */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-300 hover:text-slate-500 transition-colors">
              <Icon name="arrow_back" />
            </Link>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">자사몰 주간 교환 리포트</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sales Weekly · SKU Exchange Monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FeedbackButton />
            <button onClick={() => reload()} className="p-2 rounded-xl hover:bg-slate-50 transition-colors">
              <Icon name="sync" className={loading ? 'animate-spin text-indigo-600' : 'text-slate-400'} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-8 pb-24">
        {/* 컨트롤 바 */}
        <FeedbackSection label="기간·필터 컨트롤">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedWeek}
            onChange={(e) => { setSelectedWeek(e.target.value); setCustomRange(null); }}
            className={`bg-white border rounded-xl px-4 py-2.5 text-xs font-black focus:outline-none focus:border-indigo-400 ${
              customRange ? 'border-slate-100 text-slate-300' : 'border-slate-200 text-slate-700'
            }`}
          >
            {[...weeks].reverse().map((w) => (
              <option key={w} value={w}>
                {weekLabel(w)} · {weekTitle(w)}{w === currentWeek ? ' (이번 주 · 집계 중)' : ''}
              </option>
            ))}
          </select>

          {/* 달력 — 주차 프리셋 대신 자유 기간 조회 */}
          <div className="relative">
            <button
              onClick={() => {
                setRangeOpen((v) => !v);
                if (!draftEnd) setDraftEnd(todayStr);
              }}
              className={`flex items-center gap-1.5 border rounded-xl px-3.5 py-2.5 text-xs font-black transition-colors ${
                customRange
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600'
              }`}
              title="달력으로 기간을 자유롭게 지정해 조회"
            >
              <Icon name="calendar_month" className="text-base leading-none" />
              {customRange ? `${customRange.start} ~ ${customRange.end}` : '기간 직접 지정'}
            </button>
            {customRange && (
              <button
                onClick={() => { setCustomRange(null); setRangeOpen(false); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-700 text-white text-[10px] font-black leading-none"
                title="주차 보기로 돌아가기"
              >
                ✕
              </button>
            )}
            {rangeOpen && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-30 flex flex-col gap-3 w-[260px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  시작일
                  <input
                    type="date"
                    value={draftStart}
                    min={LIVE_EXCHANGE_MIN_DATE}
                    max={todayStr}
                    onChange={(e) => setDraftStart(e.target.value)}
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400"
                  />
                </label>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  종료일
                  <input
                    type="date"
                    value={draftEnd}
                    min={LIVE_EXCHANGE_MIN_DATE}
                    max={todayStr}
                    onChange={(e) => setDraftEnd(e.target.value)}
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400"
                  />
                </label>
                <p className="text-[10px] font-bold text-slate-400">교환 데이터는 {LIVE_EXCHANGE_MIN_DATE}부터 있습니다.</p>
                <button
                  onClick={() => {
                    if (!draftStart || !draftEnd) return;
                    const [s, e] = draftStart <= draftEnd ? [draftStart, draftEnd] : [draftEnd, draftStart];
                    setCustomRange({ start: s, end: e });
                    setRangeOpen(false);
                  }}
                  className="bg-indigo-600 text-white rounded-xl py-2.5 text-xs font-black hover:bg-indigo-500 transition-colors disabled:opacity-40"
                  disabled={!draftStart || !draftEnd}
                >
                  이 기간으로 조회
                </button>
              </div>
            )}
          </div>

          <select
            value={minShipped}
            onChange={(e) => setMinShipped(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black text-slate-500 focus:outline-none focus:border-indigo-400"
            title="출고량이 이 값 미만인 상품은 랭킹에서 제외 (소표본 교환율 왜곡 방지)"
          >
            {WEEKLY_MIN_SHIPPED_OPTIONS.map((v) => (
              <option key={v} value={v}>{customRange ? '기간' : '주간'} 출고 {v}건 이상</option>
            ))}
          </select>

          {shipFailed && (
            <span className="text-[11px] font-bold text-rose-500 bg-rose-50 px-3 py-2 rounded-xl">
              출고 데이터 조회 실패 — 교환율 없이 건수만 표시됩니다
            </span>
          )}
        </div>

        </FeedbackSection>

        {/* KPI */}
        <FeedbackSection label="주간 KPI">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard variant="compact" label={customRange ? '기간 교환율' : '주간 교환율'} tone="accent"
            value={(customStats ? customStats.rate : kpi.rate) != null ? `${(customStats ? customStats.rate! : kpi.rate!).toFixed(2)}%` : '—'}
            detail={customRange
              ? `${customRange.start} ~ ${customRange.end}`
              : selectedWeek === currentWeek
                ? '이번 주 집계 중 — 확정치 아님'
                : `${weekLabel(selectedWeek)} · ${weekTitle(selectedWeek)} 확정`}
          />
          <KpiCard variant="compact" label="교환 건수"
            value={`${(customStats ? customStats.total : kpi.exchangeCnt).toLocaleString()}건`}
            detail="네이버페이(비회원) 포함" />
          <KpiCard variant="compact" label="자사몰 출고량"
            value={(customStats ? customStats.shippedTotal : kpi.shipped) > 0
              ? `${(customStats ? customStats.shippedTotal : kpi.shipped).toLocaleString()}건`
              : '—'}
            detail="카페24(신) 기준" />
          <KpiCard variant="compact" label="전주 대비"
            tone={!customRange && kpi.deltaPp != null && kpi.deltaPp > 0 ? 'alert' : 'default'}
            value={customRange ? '—' : kpi.deltaPp != null ? `${kpi.deltaPp > 0 ? '+' : ''}${kpi.deltaPp.toFixed(2)}pp` : '—'}
            detail={customRange ? '자유 기간 조회 중' : kpi.hasPrev ? '교환율 변화' : '전주 데이터 없음'} />
        </div>

        </FeedbackSection>

        {/* 워스트 랭킹 */}
        <FeedbackSection label="랭킹 테이블">
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-black text-slate-900 text-lg tracking-tight">
                {customRange
                  ? `${customRange.start} ~ ${customRange.end}`
                  : `${weekLabel(selectedWeek)} (${weekTitle(selectedWeek)})`}
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-1">
                {customRange ? '기간' : '주간'} 출고 {minShipped}건 이상 상품만 · 열 제목(교환건수·교환율 등)을 눌러 정렬
              </p>
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">접수일 기준 · 자사몰</span>
          </div>
          <DataTable
            columns={columns}
            rows={ranking}
            rowKey={(r) => r.name}
            onRowClick={(r) => setSelectedProduct(r.name)}
            defaultSort={{ key: 'rate', dir: 'desc' }}
            maxRows={15}
            emptyMessage={`${customRange ? '기간' : '주간'} 출고 ${minShipped}건 이상이면서 교환이 발생한 상품이 없습니다.`}
          />
        </div>

        </FeedbackSection>

        {/* 히트맵 */}
        <FeedbackSection label="상품 × 주차 히트맵">
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm overflow-x-auto">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-black text-slate-900 text-lg tracking-tight">상품 × 주차 히트맵</h2>
              <p className="text-xs text-slate-400 font-bold mt-1">
                교환 총량 상위 {Math.min(HEATMAP_MAX_PRODUCTS, matrix.rows.length)}개 상품 · 색 진하기 = {heatBasis === 'rate' ? '교환율' : '교환건수'} · 마지막 열(이번 주)은 집계 중
              </p>
            </div>
            <div className="flex bg-slate-50 rounded-xl p-1 shrink-0">
              {([['rate', '교환율'], ['count', '교환건수']] as [HeatBasis, string][]).map(([basis, label]) => (
                <button
                  key={basis}
                  onClick={() => setHeatBasis(basis)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors ${
                    heatBasis === basis ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <table className="text-[11px] border-separate" style={{ borderSpacing: 2 }}>
            <thead>
              <tr>
                <th className="text-left pr-3 font-black text-slate-400 whitespace-nowrap">상품</th>
                {matrix.weeks.map((w) => (
                  <th key={w} className={`font-black px-1 whitespace-nowrap ${w === selectedWeek ? 'text-indigo-600' : 'text-slate-400'}`}>
                    <button onClick={() => { setSelectedWeek(w); setCustomRange(null); }} title={`${weekLabel(w)} · ${weekTitle(w)}`} className="hover:underline">{w.slice(5).replace('-', '/')}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.rows.map((r) => (
                <tr key={r.name}>
                  <td
                    className={`pr-3 font-black whitespace-nowrap max-w-[220px] truncate cursor-pointer hover:text-indigo-600 ${
                      selectedProduct === r.name ? 'text-indigo-600' : 'text-slate-600'
                    }`}
                    onClick={() => setSelectedProduct(r.name)}
                    title={r.name}
                  >
                    {r.name}
                  </td>
                  {matrix.weeks.map((w) => {
                    const cell = r.cells[w];
                    const v = heatBasis === 'rate' ? cell?.rate ?? 0 : cell?.exchangeCnt ?? 0;
                    const alpha = v > 0 ? 0.15 + 0.85 * Math.min(1, v / heatmap.max) : 0;
                    const isCur = w === currentWeek;
                    return (
                      <td
                        key={w}
                        className={`text-center font-bold rounded-md px-2 py-1.5 min-w-[52px] cursor-pointer ${isCur ? 'opacity-60' : ''}`}
                        style={{
                          backgroundColor: alpha > 0 ? `rgba(99,102,241,${alpha.toFixed(2)})` : '#f8fafc',
                          color: alpha > 0.55 ? '#fff' : '#475569',
                          border: isCur ? '1px dashed #cbd5e1' : undefined,
                        }}
                        title={`${r.name} · ${weekLabel(w)}\n교환 ${cell?.exchangeCnt ?? 0}건 / 출고 ${cell?.shipped?.toLocaleString() ?? '—'}${cell?.rate != null ? ` · ${cell.rate.toFixed(1)}%` : ''}`}
                        onClick={() => { setSelectedProduct(r.name); setSelectedWeek(w); setCustomRange(null); }}
                      >
                        {heatBasis === 'rate' ? (cell?.rate != null ? cell.rate.toFixed(1) : '·') : (cell?.exchangeCnt || '·')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        </FeedbackSection>

        {/* 드릴다운 (상품 검색 포함) */}
        <FeedbackSection label="상품 드릴다운">
        <div className="bg-slate-900 text-white p-8 rounded-[32px] shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Product Drilldown · 최근 {matrix.weeks.length}주</p>
              {selectedProduct ? (
                <>
                  <h2 className="text-xl font-black tracking-tight">{selectedProduct}</h2>
                  <p className="text-xs font-bold opacity-60 mt-1">기간 내 교환 {drilldown?.total.toLocaleString()}건</p>
                </>
              ) : (
                <h2 className="text-xl font-black tracking-tight opacity-40">상품을 검색하거나 위 표에서 클릭하세요</h2>
              )}
            </div>
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full lg:w-[360px]">
                <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-base" />
                <input
                  type="text"
                  placeholder="상품명 검색..."
                  className="w-full bg-white/10 border border-white/20 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold focus:outline-none focus:bg-white/20 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl max-h-[280px] overflow-y-auto z-30">
                    {matrix.rows
                      .filter((r) => r.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) && r.name !== selectedProduct)
                      .slice(0, 12)
                      .map((r) => (
                        <div
                          key={r.name}
                          className="px-4 py-3 hover:bg-indigo-600 cursor-pointer text-xs font-bold border-b border-white/5 last:border-0 transition-colors flex justify-between gap-3"
                          onClick={() => { setSelectedProduct(r.name); setSearchTerm(''); }}
                        >
                          <span className="truncate">{r.name}</span>
                          <span className="opacity-50 shrink-0">교환 {r.totalExchanges}건</span>
                        </div>
                      ))}
                    {matrix.rows.filter((r) => r.name.toLowerCase().includes(searchTerm.trim().toLowerCase())).length === 0 && (
                      <p className="px-4 py-3 text-xs opacity-40 italic">기간 내 교환이 발생한 상품 중에 없습니다</p>
                    )}
                  </div>
                )}
              </div>
              {selectedProduct && (
                <button onClick={() => setSelectedProduct(null)} className="opacity-40 hover:opacity-100 transition-opacity shrink-0">
                  <Icon name="close" />
                </button>
              )}
            </div>
          </div>
          {selectedProduct && drilldown && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 주차별 미니 추이 */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-4">주차별 교환건수 · 교환율</p>
                <div className="space-y-2">
                  {matrix.weeks.map((w) => {
                    const cell = drilldown.productRow?.cells[w];
                    const cnt = cell?.exchangeCnt ?? 0;
                    const maxCnt = Math.max(1, ...matrix.weeks.map((x) => drilldown.productRow?.cells[x]?.exchangeCnt ?? 0));
                    return (
                      <div key={w} className="flex items-center gap-3">
                        <span className={`text-[10px] font-black w-12 shrink-0 ${w === currentWeek ? 'opacity-40' : 'opacity-70'}`}>
                          {w.slice(5).replace('-', '/')}
                        </span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(cnt / maxCnt) * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-black w-20 text-right shrink-0">
                          {cnt}건{cell?.rate != null ? ` · ${cell.rate.toFixed(1)}%` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 교환 전 옵션 분포 */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-4">어떤 옵션에서 교환이 나오나 (교환 전 옵션)</p>
                <div className="space-y-3">
                  {drilldown.topFrom.map((it) => (
                    <div key={it.key} className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold truncate">{it.key}</span>
                      <span className="text-xs font-black text-indigo-400 shrink-0">{it.cnt}건</span>
                    </div>
                  ))}
                  {drilldown.topFrom.length === 0 && <p className="text-xs opacity-30 italic">데이터 없음</p>}
                </div>
              </div>

              {/* 옵션 스왑 TOP */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-4">옵션 이동 TOP (전 → 후)</p>
                <div className="space-y-3">
                  {drilldown.topSwap.map((it) => (
                    <div key={it.key} className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold truncate">{it.key}</span>
                      <span className="text-xs font-black text-indigo-400 shrink-0">{it.cnt}건</span>
                    </div>
                  ))}
                  {drilldown.topSwap.length === 0 && <p className="text-xs opacity-30 italic">데이터 없음</p>}
                </div>
              </div>
            </div>
            <p className="text-[10px] font-bold opacity-40 mt-8">
              같은 옵션 재출고 비중이 높으면 불량/오배송 신호, 사이즈 이동이 많으면 상세페이지 실측·사이즈 가이드 점검 신호입니다.
            </p>
          </>
          )}
        </div>
        </FeedbackSection>

        <p className="text-[11px] font-bold text-slate-400">
          집계 기준: 접수일 · 주 시작 = 월요일 · 교환율 = 교환건수 ÷ 자사몰(카페24) 주간 출고량 · 교환 데이터 시작 2026-05-04 (라이브 시트)
        </p>
      </main>
    </div>
    </FeedbackProvider>
  );
};

export default SalesView;
