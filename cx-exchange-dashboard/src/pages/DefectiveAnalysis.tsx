import React, { useState, useMemo } from 'react';
import { Icon } from '../components/ui/Icon';
import { DateFilter } from '../components/ui/DateFilter';
import { KpiCard, type KpiTone } from '../components/ui/KpiCard';
import { ChartCard } from '../components/ui/ChartCard';
import { DataTable, type Column } from '../components/ui/DataTable';
import { RateBadge } from '../components/ui/RateBadge';
import { MatchCoverageChip } from '../components/ui/MatchCoverageChip';
import { MinShipmentFilter } from '../components/ui/MinShipmentFilter';
import { useDashboardData } from '../hooks/useDashboardData';
import { useShipments } from '../hooks/useShipments';
import { useStickyState } from '../hooks/useStickyState';
import { AXIS_PROPS, GRID_PROPS, rateTooltipFormatter } from '../lib/chartTheme';
import { computeRate, lookupProduct, buildMatchCoverage, DEFECT_RATE_BANDS, MIN_SHIPPED_DEFAULT } from '../lib/rate';
import { DEFECT_CATEGORIES, classifyDefect, normalizeChannel, type DefectCategory } from '../lib/exchange';
import { Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart } from 'recharts';

interface DefectRankRow {
  name: string;
  category1: string;
  defects: number;
  shipped: number | null;
  rate: number | null;
  topReasons: string[];
}

// 불량 시트의 모든 행을 실제 사유값 기준으로 단일 분류.
// 제품 결함(생산/QC 액션) vs 운영·물류 오류(CX/물류 액션) vs 비불량(변심 등)을 분리해
// "진짜 품질 문제"가 얼마나 되는지 보여주는 것이 핵심.
export const DefectiveAnalysis: React.FC = () => {
  const { data, loading, reload, startDate, endDate, setStartDate, setEndDate, reloadKey } = useDashboardData('bulryang');
  const { shipments, index: shipIdx, failed: shipFailed } = useShipments(startDate, endDate, reloadKey);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [minShipped, setMinShipped] = useStickyState('cx.minShipped.product', MIN_SHIPPED_DEFAULT);
  const [categoryFilter, setCategoryFilter] = useState<string>('전체');

  const { total, groupSummary, categorySummary, monthlyTrend, bigCategoryStats, channelDefects, itemToBig, allDefectItems } = useMemo(() => {
    const empty = {
      total: 0,
      groupSummary: { product: 0, ops: 0, nonDefect: 0, unknown: 0 },
      categorySummary: [] as (DefectCategory & { count: number; pct: number; topOptions: { label: string; count: number }[] })[],
      monthlyTrend: [] as any[],
      bigCategoryStats: [] as { name: string; count: number }[],
      channelDefects: [] as { name: string; count: number }[],
      itemToBig: {} as Record<string, string>,
      allDefectItems: [] as { name: string; count: number; reasons: Record<string, number> }[],
    };
    if (!data?.data.bulryang) return empty;

    const filtered = data.data.bulryang.filter(row => {
      const rowDate = row['접수일']?.replace(/\./g, '-');
      return rowDate && rowDate >= startDate && rowDate <= endDate;
    });
    const total = filtered.length;

    // 행마다 단일 분류 (키워드 중복 집계 없음)
    const classified = filtered.map(r => ({ row: r, cat: classifyDefect(r['불량 사유']) }));
    const groupSummary = { product: 0, ops: 0, nonDefect: 0, unknown: 0 };
    classified.forEach(({ cat }) => {
      if (!cat) groupSummary.unknown++;
      else groupSummary[cat.group]++;
    });

    // 카테고리별 요약 + 상위 상품/옵션 드릴다운
    const categorySummary = DEFECT_CATEGORIES.map(cat => {
      const rows = classified.filter(c => c.cat?.key === cat.key).map(c => c.row);
      const optionMap: Record<string, number> = {};
      rows.forEach(r => {
        const name = r['상품명']?.trim() || '';
        const option = r['교환 전 옵션']?.trim() || '';
        const key = option ? `${name} / ${option}` : name;
        if (key) optionMap[key] = (optionMap[key] || 0) + 1;
      });
      const topOptions = Object.entries(optionMap)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      return { ...cat, count: rows.length, pct: total > 0 ? Math.round((rows.length / total) * 100) : 0, topOptions };
    }).filter(c => c.count > 0);

    // 월별 추이 (그룹별 스택) — 기간 필터와 무관하게 전체 데이터 기준
    const monthMap: Record<string, { month: string; product: number; ops: number; nonDefect: number; unknown: number }> = {};
    data.data.bulryang.forEach(r => {
      const d = (r['접수일'] || '').replace(/\./g, '-');
      if (!/^\d{4}-\d{2}/.test(d)) return;
      const m = d.substring(0, 7);
      if (!monthMap[m]) monthMap[m] = { month: m, product: 0, ops: 0, nonDefect: 0, unknown: 0 };
      const cat = classifyDefect(r['불량 사유']);
      if (!cat) monthMap[m].unknown++;
      else monthMap[m][cat.group]++;
    });
    const monthlyTrend = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    // 상품 대분류(브라/팬티/어패럴…)별 제품결함 분포 — 재고관리 시트 ITEM 매칭 (99% 매칭 확인됨)
    const itemToBig: Record<string, string> = {};
    (data.data.inventory || []).forEach(r => {
      const item = (r['ITEM'] || '').trim();
      const big = (r['대분류'] || '').trim();
      if (item && big && !itemToBig[item]) itemToBig[item] = big;
    });
    const bigMap: Record<string, number> = {};
    classified.forEach(({ row, cat }) => {
      if (cat?.group !== 'product') return;
      const big = itemToBig[(row['상품명'] || '').trim()] || '기타';
      bigMap[big] = (bigMap[big] || 0) + 1;
    });
    const bigCategoryStats = Object.entries(bigMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // 채널별 불량 접수 (자사몰 vs 외부몰 채널)
    const chMap: Record<string, number> = {};
    filtered.forEach(r => {
      const ch = normalizeChannel(r['교환 형태 및 채널']);
      chMap[ch] = (chMap[ch] || 0) + 1;
    });
    const channelDefects = Object.entries(chMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);

    // 상품별 제품결함 집계 — "제품 결함"으로 분류된 건만 (변심·전산오류 제외), 불량률 랭킹 테이블의 소스
    const itemMap: Record<string, { count: number; reasons: Record<string, number> }> = {};
    classified.forEach(({ row, cat }) => {
      if (cat?.group !== 'product') return;
      const name = row['상품명']?.trim();
      const reason = row['불량 사유']?.trim() || '미분류';
      if (!name) return;
      if (!itemMap[name]) itemMap[name] = { count: 0, reasons: {} };
      itemMap[name].count++;
      itemMap[name].reasons[reason] = (itemMap[name].reasons[reason] || 0) + 1;
    });
    const allDefectItems = Object.entries(itemMap).map(([name, { count, reasons }]) => ({ name, count, reasons }));

    return { total, groupSummary, categorySummary, monthlyTrend, bigCategoryStats, channelDefects, itemToBig, allDefectItems };
  }, [data, startDate, endDate]);

  // 불량률 — 출고 데이터(shipIdx) 로드 후 계산. 상품별 랭킹은 별도 useMemo로 분리.
  const { defectRate, matchCoverage, monthlyRate, rankRows } = useMemo(() => {
    if (!shipIdx) return { defectRate: null, matchCoverage: null, monthlyRate: [] as any[], rankRows: [] as DefectRankRow[] };

    const rate = computeRate(groupSummary.product, shipIdx.total.total);
    const coverage = data?.data.bulryang
      ? buildMatchCoverage(data.data.bulryang.filter((r) => {
          const d = r['접수일']?.replace(/\./g, '-');
          return d && d >= startDate && d <= endDate;
        }), shipIdx)
      : null;

    // 월별 불량률 — 월별 총 출고량(shipments.byDay를 월 단위로 합산) 대비 monthlyTrend.product
    const monthShipMap = new Map<string, number>();
    shipments?.byDay.forEach((r) => {
      const m = r.date.substring(0, 7);
      monthShipMap.set(m, (monthShipMap.get(m) || 0) + r.qty);
    });
    const monthlyRateArr = monthlyTrend.map((m: any) => {
      const shipped = monthShipMap.get(m.month) ?? null;
      const rate = shipped && shipped > 0 ? (m.product / shipped) * 100 : null;
      return { ...m, rate };
    });

    const rankRows: DefectRankRow[] = allDefectItems.map((item) => {
      const shipped = lookupProduct(shipIdx, item.name);
      const r = computeRate(item.count, shipped?.total ?? null, 0);
      const topReasons = Object.entries(item.reasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([reason]) => reason);
      return {
        name: item.name,
        category1: itemToBig[item.name] || '기타',
        defects: item.count,
        shipped: r.shipped,
        rate: r.rate,
        topReasons,
      };
    });

    return { defectRate: rate, matchCoverage: coverage, monthlyRate: monthlyRateArr, rankRows };
  }, [shipIdx, shipments, groupSummary, allDefectItems, itemToBig, monthlyTrend, data, startDate, endDate]);

  if (loading && !data) return (
    <div className="flex h-[80vh] items-center justify-center text-rose-600 font-black animate-pulse">품질 정밀 분석 데이터 집계 중...</div>
  );

  // KpiCard tone에 없는 값 색(amber-600, slate-400)은 valueClass로 보존
  const GROUP_KPI: { label: string; value: number; tone: KpiTone; valueClass?: string; accent: 'indigo' | 'rose' | 'amber' | 'slate'; desc: string }[] = [
    { label: '제품 결함', value: groupSummary.product, tone: 'alert', accent: 'rose', desc: '원단·패드·봉제·오염 등 → 생산/QC 공유' },
    { label: '운영·물류 오류', value: groupSummary.ops, tone: 'default', valueClass: '[&_h3]:text-amber-600!', accent: 'amber', desc: '전산오처리·내품오류·오출고 → 프로세스 개선' },
    { label: '비불량 (변심·착용후)', value: groupSummary.nonDefect, tone: 'default', valueClass: '[&_h3]:text-slate-400!', accent: 'slate', desc: '불량 통계에서 제외해야 하는 건' },
    { label: '확인필요 (미분류)', value: groupSummary.unknown, tone: 'accent', accent: 'indigo', desc: '사유 입력 필요 — 데이터 품질 지표' },
  ];

  const productDefectPct = total > 0 ? Math.round((groupSummary.product / total) * 100) : 0;

  const categoryOptions = ['전체', ...Array.from(new Set(rankRows.map((r) => r.category1))).sort()];
  const filteredRankRows = rankRows
    .filter((r) => categoryFilter === '전체' || r.category1 === categoryFilter)
    .filter((r) => (r.shipped ?? 0) >= minShipped || r.shipped === null)
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  const hiddenCount = rankRows.filter((r) => categoryFilter === '전체' || r.category1 === categoryFilter).length - filteredRankRows.length;

  const rankColumns: Column<DefectRankRow>[] = [
    { key: 'name', header: '상품명', render: (r) => <span className="font-black text-slate-800">{r.name}</span> },
    { key: 'category1', header: '대분류', render: (r) => <span className="font-bold text-slate-400">{r.category1}</span> },
    { key: 'defects', header: '결함건수', align: 'right', sortValue: (r) => r.defects, render: (r) => <span className="font-black text-rose-600">{r.defects}건</span> },
    { key: 'shipped', header: '출고량', align: 'right', sortValue: (r) => r.shipped, render: (r) => <span className="font-bold text-slate-500">{r.shipped !== null ? r.shipped.toLocaleString() : '-'}</span> },
    { key: 'rate', header: '불량률', align: 'right', sortValue: (r) => r.rate, render: (r) => <RateBadge rate={r.rate} exchanges={r.defects} shipped={r.shipped} bands={DEFECT_RATE_BANDS} /> },
    { key: 'topReasons', header: '주요 사유', render: (r) => <span className="text-[11px] text-slate-400 font-bold">{r.topReasons.join(' · ') || '-'}</span> },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full pb-20">
      {/* ── 헤더 ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">주요 불량 이슈 분석</h2>
          <p className="text-sm text-slate-400 font-bold mt-1 uppercase tracking-widest opacity-70">Defect Root Cause & Product Correlation</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
            <DateFilter startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
            <button onClick={() => reload()} className="p-2 hover:bg-slate-50 transition-colors border-l border-slate-100 ml-1">
              <Icon name="sync" className={loading ? 'animate-spin text-rose-600' : 'text-slate-400'} />
            </button>
          </div>
          <MatchCoverageChip coverage={matchCoverage} failed={shipFailed} />
        </div>
      </div>

      {/* ── 전사 불량률 (출고 대비) + 접수건수 ──────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        <KpiCard
          label="전사 불량률"
          value={defectRate?.rate !== null && defectRate?.rate !== undefined ? `${defectRate.rate.toFixed(1)}%` : '—'}
          detail={`제품결함 ${groupSummary.product.toLocaleString()}건 / 출고 ${defectRate?.shipped != null ? `${defectRate.shipped.toLocaleString()}건` : '집계 중'} · 전체 접수 ${total.toLocaleString()}건`}
          tone="alert"
          accentColor="rose"
        />
        {GROUP_KPI.map((k, i) => (
          <KpiCard
            key={i}
            label={k.label}
            value={k.value.toLocaleString()}
            unit="건"
            detail={k.desc}
            tone={k.tone}
            accentColor={k.accent}
            className={k.valueClass}
          />
        ))}
      </div>

      {/* ── 월별 추이 (스택) ─────────────────────────────────── */}
      <ChartCard
        title="월별 불량 접수 추이"
        subtitle="막대=분류별 접수건수(좌축) · 선=불량률%(우축, 출고 데이터가 있는 2026-03 이후만)"
        height={300}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={monthlyRate.length > 0 ? monthlyRate : monthlyTrend}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="month" {...AXIS_PROPS} />
            <YAxis yAxisId="left" {...AXIS_PROPS} />
            <YAxis yAxisId="right" orientation="right" {...AXIS_PROPS} unit="%" />
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} formatter={rateTooltipFormatter} />
            <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
            <Bar yAxisId="left" dataKey="product" name="제품 결함" stackId="a" fill="#e11d48" />
            <Bar yAxisId="left" dataKey="ops" name="운영·물류 오류" stackId="a" fill="#f59e0b" />
            <Bar yAxisId="left" dataKey="nonDefect" name="비불량(변심 등)" stackId="a" fill="#cbd5e1" />
            <Bar yAxisId="left" dataKey="unknown" name="확인필요" stackId="a" fill="#818cf8" radius={[6, 6, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="rate" name="불량률(%)" stroke="#be123c" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── 메인 그리드 ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── 왼쪽: 유형별 요약 (expandable) ─────────────────── */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-8 rounded-[32px] border-2 border-slate-100 shadow-xl relative overflow-hidden">
            <Icon name="analytics" className="absolute -right-10 -top-10 text-[200px] opacity-[0.03] rotate-12 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                <h4 className="text-lg font-black text-slate-900 uppercase">사유별 상세</h4>
                <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-3 py-1 rounded-full">제품결함 {productDefectPct}%</span>
              </div>

              <div className="space-y-6">
                {categorySummary.map((cat) => (
                  <div key={cat.key}>
                    <button
                      className="w-full group text-left"
                      onClick={() => setExpandedCategory(expandedCategory === cat.key ? null : cat.key)}
                    >
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <p className="text-sm font-black text-slate-600 tracking-tight mb-1">
                            {cat.name}
                            {cat.group !== 'product' && <span className="ml-2 text-[9px] font-black text-slate-300 uppercase">{cat.group === 'ops' ? '운영' : '비불량'}</span>}
                          </p>
                          <p className="text-3xl font-black text-slate-900">{cat.count} <span className="text-xs opacity-30">건</span></p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-300 group-hover:text-rose-500 transition-colors">{cat.pct}%</span>
                          <Icon name={expandedCategory === cat.key ? 'expand_less' : 'expand_more'} className="text-slate-300 text-base group-hover:text-slate-500 transition-colors" />
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden mb-1">
                        <div className="h-full rounded-full transition-all duration-700" style={{ backgroundColor: cat.color, width: `${cat.pct}%` }}></div>
                      </div>
                    </button>

                    {expandedCategory === cat.key && (
                      <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-60" style={{ color: cat.color }}>
                          주요 접수 상품/옵션 (상위 5)
                        </p>
                        {cat.topOptions.map((opt, j) => (
                          <div key={j} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs font-black shrink-0" style={{ color: cat.color }}>#{j + 1}</span>
                              <span className="text-xs font-bold text-slate-700 truncate">{opt.label}</span>
                            </div>
                            <span className="text-xs font-black shrink-0" style={{ color: cat.color }}>{opt.count}건</span>
                          </div>
                        ))}
                        {cat.topOptions.length === 0 && (
                          <p className="text-xs text-slate-400 italic">데이터 없음</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {groupSummary.unknown > 0 && (
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <p className="text-sm font-black text-indigo-400 tracking-tight mb-1">확인필요 / 사유 미입력</p>
                        <p className="text-3xl font-black text-indigo-400">{groupSummary.unknown} <span className="text-xs opacity-30">건</span></p>
                      </div>
                      <span className="text-xs font-black text-slate-300">{total > 0 ? Math.round((groupSummary.unknown / total) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-300 rounded-full" style={{ width: `${total > 0 ? Math.round((groupSummary.unknown / total) * 100) : 0}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 대분류 × 채널 분포 */}
          <div className="bg-slate-900 p-8 rounded-[32px] shadow-xl text-white">
            <h4 className="text-base font-black mb-6 border-b border-white/10 pb-4">제품결함 분포 — 상품 대분류 / 채널</h4>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-4">대분류별 (제품결함만)</p>
                <div className="space-y-3">
                  {bigCategoryStats.slice(0, 6).map((b, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="font-bold opacity-70">{b.name}</span>
                      <span className="font-black text-rose-400">{b.count}건</span>
                    </div>
                  ))}
                  {bigCategoryStats.length === 0 && <p className="text-xs opacity-30 italic">데이터 없음</p>}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-4">채널별 (전체 접수)</p>
                <div className="space-y-3">
                  {channelDefects.map((c, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="font-bold opacity-70">{c.name}</span>
                      <span className="font-black text-orange-400">{c.count}건</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 오른쪽: 상품별 불량률 랭킹 (출고 대비) ──────────── */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <div>
                <h4 className="font-black text-2xl text-slate-900 tracking-tight">상품별 불량률 랭킹</h4>
                <p className="text-xs text-slate-400 font-bold mt-1">출고 대비 제품결함 비율 기준. 소량 출고 상품의 왜곡을 막기 위해 최소 출고량 필터를 적용합니다.</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-[10px] font-black bg-slate-100 text-slate-600 rounded-lg px-2 py-1.5 uppercase tracking-widest"
                >
                  {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <MinShipmentFilter value={minShipped} onChange={setMinShipped} />
              </div>
            </div>
            <DataTable
              columns={rankColumns}
              rows={filteredRankRows}
              rowKey={(r) => r.name}
              maxRows={10}
              emptyMessage="조회 기간 내 제품결함 데이터가 없습니다."
            />
            {hiddenCount > 0 && (
              <p className="text-[10px] font-bold text-slate-300 mt-3">표본부족(출고 {minShipped}개 미만)으로 숨겨진 상품 {hiddenCount}개</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
