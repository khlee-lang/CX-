import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { DateFilter } from '../components/ui/DateFilter';
import { KpiCard } from '../components/ui/KpiCard';
import { ChartCard } from '../components/ui/ChartCard';
import { RateBadge } from '../components/ui/RateBadge';
import { MatchCoverageChip } from '../components/ui/MatchCoverageChip';
import { useDashboardData } from '../hooks/useDashboardData';
import { useShipments } from '../hooks/useShipments';
import { useExchangeHistory } from '../hooks/useExchangeHistory';
import { ControlChart } from '../components/ui/ControlChart';
import { buildLiveDailyExchange } from '../lib/controlChart';
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE, TOOLTIP_CURSOR, SERIES_COLORS } from '../lib/chartTheme';
import { computeRate, lookupProduct, buildMatchCoverage, isJasaScopedChannel } from '../lib/rate';
import { shipStatus, isShipped, leadTimeDays, median, toISODate, needsRecovery, shippingFee, classifyDefect } from '../lib/exchange';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export const OverviewDashboard: React.FC = () => {
  const { data, loading, reload, startDate, endDate, setStartDate, setEndDate, reloadKey } = useDashboardData('all');
  const { index: shipIdx, failed: shipFailed } = useShipments(startDate, endDate, reloadKey);

  // 관제 그래프용 — KPI 날짜 필터와 무관하게 항상 전체 히스토리(2024-05~현재)를 보여준다.
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const controlChartShip = useShipments('2024-05-02', todayStr, reloadKey);
  const { exchangeHistory } = useExchangeHistory();
  const liveDaily = useMemo(
    () => buildLiveDailyExchange(data?.data.jasaMall || [], data?.data.oebuMall || []),
    [data],
  );

  // 직전 동일 기간 — 품질 급증 경보를 "건수 급증"이 아니라 "불량률 급증"으로 판단하려면
  // 직전 기간의 출고량(분모)도 필요하다. BQ 스캔량이 작아(수 MB) 추가 조회 비용은 무시할 수준.
  const prevRange = useMemo(() => {
    if (!startDate || !endDate) return { start: undefined, end: undefined };
    const s = new Date(startDate);
    const diffDays = Math.max(1, Math.ceil((new Date(endDate).getTime() - s.getTime()) / 86400000));
    const ps = new Date(s); ps.setDate(ps.getDate() - diffDays);
    const pe = new Date(s); pe.setDate(pe.getDate() - 1);
    return { start: ps.toISOString().split('T')[0], end: pe.toISOString().split('T')[0] };
  }, [startDate, endDate]);
  const { index: prevShipIdx } = useShipments(prevRange.start, prevRange.end, reloadKey);

  const { stats, chartData, pieData, topProducts, agingData, opsData, deptSummary, filteredData, productDefectTotal, curDefect, prevDefect } = useMemo(() => {
    if (!data || !startDate || !endDate) return {
      filteredData: { jasa: [], bulryang: [], oebu: [] },
      stats: { jasa: 0, bulryang: 0, oebu: 0, total: 0, mom: 0, jasaScoped: 0, oebuScoped: 0, oebuJasaScoped: 0 },
      chartData: [], pieData: [], topProducts: [],
      agingData: { d3: 0, d5: 0, d7: 0, waitingStock: 0, notReceived: 0, pending: 0 },
      opsData: { leadMedian: null as number | null, prevLeadMedian: null as number | null, shipRate: 0, recoveryOverdue: 0, totalFee: 0, repeatCustomers: 0 },
      deptSummary: { topDefectProduct: null as { name: string; count: number } | null, freeRate: 0 },
      productDefectTotal: 0, prevProductDefectTotal: 0,
      curDefect: {} as Record<string, number>, prevDefect: {} as Record<string, number>,
    };

    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    const diffDays = Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Previous Period for MoM
    const prevStartDate = new Date(sDate);
    prevStartDate.setDate(prevStartDate.getDate() - diffDays);
    const prevEndDate = new Date(sDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);

    const filterFn = (row: any) => {
      const rowDate = row['접수일']?.replace(/\./g, '-');
      return rowDate && rowDate >= startDate && rowDate <= endDate;
    };

    const prevFilterFn = (row: any) => {
      const rowDate = row['접수일']?.replace(/\./g, '-');
      const ps = prevStartDate.toISOString().split('T')[0];
      const pe = prevEndDate.toISOString().split('T')[0];
      return rowDate && rowDate >= ps && rowDate <= pe;
    };

    const jasa = (data.data.jasaMall || []).filter(filterFn);
    const bulryang = (data.data.bulryang || []).filter(filterFn);
    const oebu = (data.data.oebuMall || []).filter(filterFn);

    const prevJasa = (data.data.jasaMall || []).filter(prevFilterFn);
    const prevBulryang = (data.data.bulryang || []).filter(prevFilterFn);
    const prevOebu = (data.data.oebuMall || []).filter(prevFilterFn);

    const currentTotal = jasa.length + bulryang.length + oebu.length;
    const prevTotal = prevJasa.length + prevBulryang.length + prevOebu.length;
    const mom = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : 0;

    // 네이버페이는 [외부몰] 시트에 기재되지만 실제로는 자사몰(카페24) 주문이라
    // 출고량도 카페24에 포함된다 → 교환율 분자를 자사몰 쪽으로 옮겨야 범위가 맞는다.
    const oebuJasaScoped = oebu.filter((r) => isJasaScopedChannel(r['채널명'])).length;

    const statsObj = {
      jasa: jasa.length,
      bulryang: bulryang.length,
      oebu: oebu.length,
      total: currentTotal,
      mom,
      // 교환율 계산용 — 출고 채널 기준으로 재배분한 건수
      jasaScoped: jasa.length + oebuJasaScoped,
      oebuScoped: oebu.length - oebuJasaScoped,
      oebuJasaScoped,
    };

    // Prepare Chart Data (Daily Trend) — 데이터 없는 날짜도 0으로 채워서
    // 실제 접수가 없는 날(주말 등)이 그래프에서 빠지고 이어져 보이지 않게 함
    const dailyMap: Record<string, { jasa: number, oebu: number, bulryang: number }> = {};
    const processRows = (rows: any[], key: 'jasa' | 'oebu' | 'bulryang') => {
      rows.forEach(r => {
        const d = r['접수일']?.replace(/\./g, '-');
        if (d) {
          if (!dailyMap[d]) dailyMap[d] = { jasa: 0, oebu: 0, bulryang: 0 };
          dailyMap[d][key]++;
        }
      });
    };
    processRows(jasa, 'jasa');
    processRows(oebu, 'oebu');
    processRows(bulryang, 'bulryang');
    const chartArr: { date: string, jasa: number, oebu: number, bulryang: number }[] = [];
    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      const entry = dailyMap[key] || { jasa: 0, oebu: 0, bulryang: 0 };
      chartArr.push({ date: key.substring(5), ...entry });
    }

    // Pie Data
    const pieArr = [
      { name: '자사몰', value: statsObj.jasa, color: '#6366f1' },
      { name: '외부몰', value: statsObj.oebu, color: '#f97316' },
      { name: '불량', value: statsObj.bulryang, color: '#ef4444' },
    ].filter(v => v.value > 0);

    // Top Products (불량 건수 함께 집계 → 품질 신호 표시)
    const prodMap: Record<string, { count: number; defect: number }> = {};
    [...jasa, ...oebu, ...bulryang].forEach(r => {
      const name = r['상품명']?.trim();
      if (!name) return;
      if (!prodMap[name]) prodMap[name] = { count: 0, defect: 0 };
      prodMap[name].count++;
    });
    bulryang.forEach(r => {
      const name = r['상품명']?.trim();
      if (name && prodMap[name]) prodMap[name].defect++;
    });
    const topProdArr = Object.entries(prodMap)
      .map(([name, v]) => ({ name, ...v, share: currentTotal > 0 ? Math.round((v.count / currentTotal) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Aging Analysis — 출고일이 "실제 날짜"인 건만 처리완료로 간주
    // ('입고0707' 같은 재고대기, '미입고' 등이 처리완료로 잘못 잡히던 문제 수정)
    const today = new Date();
    const agingMap = { d3: 0, d5: 0, d7: 0, waitingStock: 0, notReceived: 0, pending: 0 };
    const allRows = [...jasa, ...oebu, ...bulryang];
    allRows.forEach(r => {
      const status = shipStatus(r);
      if (status === 'shipped') return;
      if (status === 'waitingStock') agingMap.waitingStock++;
      else if (status === 'notReceived') agingMap.notReceived++;
      else agingMap.pending++;
      const reg = toISODate(r['접수일']);
      if (reg) {
        const days = Math.floor((today.getTime() - new Date(reg).getTime()) / 86400000);
        if (days >= 7) agingMap.d7++;
        else if (days >= 5) agingMap.d5++;
        else if (days >= 3) agingMap.d3++;
      }
    });

    // 운영 지표 (리드타임·처리율) — 채널 전체를 아우르는 지표만 남김
    const leadTimes = allRows.map(leadTimeDays).filter((v): v is number => v !== null);
    const prevLeadTimes = [...prevJasa, ...prevOebu, ...prevBulryang].map(leadTimeDays).filter((v): v is number => v !== null);
    const shippedCount = allRows.filter(isShipped).length;

    // 회수 지연 — 접수 후 7일+ 지났는데 아직 미집화 (자사몰+불량 시트만; 외부몰엔 회수내역 필드 없음)
    const recoveryOverdue = [...jasa, ...bulryang].filter(r => {
      if (!needsRecovery(r)) return false;
      const reg = toISODate(r['접수일']);
      if (!reg) return false;
      const days = Math.floor((today.getTime() - new Date(reg).getTime()) / 86400000);
      return days >= 7;
    }).length;

    // 교환 배송비 수취 총액 (전 채널)
    const totalFee = allRows.reduce((sum, r) => sum + shippingFee(r), 0);

    // 반복교환 고객 (기간 내 3회 이상, 전 채널 연락처 기준)
    const phoneCount: Record<string, number> = {};
    allRows.forEach(r => {
      const p = (r['연락처'] || '').trim();
      if (p) phoneCount[p] = (phoneCount[p] || 0) + 1;
    });
    const repeatCustomers = Object.values(phoneCount).filter(c => c >= 3).length;

    const ops = {
      leadMedian: median(leadTimes),
      prevLeadMedian: median(prevLeadTimes),
      shipRate: allRows.length > 0 ? Math.round((shippedCount / allRows.length) * 100) : 0,
      recoveryOverdue,
      totalFee,
      repeatCustomers,
    };

    // 품질 급증 경보 — 제품결함(변심·전산오류 제외) 상품별 현재기간 vs 직전기간 비교
    // 트리거: 현재 5건 이상 AND 직전기간의 2배 이상
    const defectCount = (rows: any[]) => {
      const m: Record<string, number> = {};
      rows.forEach(r => {
        if (classifyDefect(r['불량 사유'])?.group !== 'product') return;
        const name = r['상품명']?.trim();
        if (name) m[name] = (m[name] || 0) + 1;
      });
      return m;
    };
    const curDefect = defectCount(bulryang);
    const prevDefect = defectCount(prevBulryang);
    const productDefectTotal = Object.values(curDefect).reduce((a, b) => a + b, 0);
    const prevProductDefectTotal = Object.values(prevDefect).reduce((a, b) => a + b, 0);

    // 부서별 원라이너 — 생산/QC(제품결함 1위 상품), 재무(무료교환 비중)
    const topDefectEntry = Object.entries(curDefect).sort((a, b) => b[1] - a[1])[0];
    const freeCount = jasa.filter(r => r['첫주문여부[자동]'] === '무료교환').length;
    const dept = {
      topDefectProduct: topDefectEntry ? { name: topDefectEntry[0], count: topDefectEntry[1] } : null,
      freeRate: jasa.length > 0 ? Math.round((freeCount / jasa.length) * 100) : 0,
    };

    return {
      filteredData: { jasa, bulryang, oebu }, stats: statsObj, chartData: chartArr, pieData: pieArr,
      topProducts: topProdArr, agingData: agingMap, opsData: ops, deptSummary: dept,
      productDefectTotal, prevProductDefectTotal, curDefect, prevDefect,
    };
  }, [data, startDate, endDate]);

  // 품질 급증 경보 — 건수가 아니라 "불량률"이 직전 기간의 2배 이상으로 뛴 상품.
  // 출고량이 붙기 전(또는 조회 실패)에는 기존 건수 기준으로 폴백한다.
  const qualityAlerts = useMemo(() => {
    const MIN_VOL = 100; // 출고 100개 미만은 1~2건으로도 비율이 튀어 경보 대상에서 제외
    if (shipIdx && prevShipIdx) {
      return Object.entries(curDefect)
        .map(([name, count]) => {
          const curShipped = lookupProduct(shipIdx, name)?.total ?? null;
          const prevShipped = lookupProduct(prevShipIdx, name)?.total ?? null;
          const prevCount = prevDefect[name] || 0;
          const curRate = curShipped && curShipped > 0 ? (count / curShipped) * 100 : null;
          const prevRate = prevShipped && prevShipped > 0 ? (prevCount / prevShipped) * 100 : null;
          return { name, count, prevCount, curShipped, curRate, prevRate };
        })
        .filter((a) =>
          a.curRate !== null &&
          (a.curShipped ?? 0) >= MIN_VOL &&
          a.count >= 3 &&
          // 직전 기간 불량률이 0이면 비교 불가 → 건수 기준으로 급증 판단
          (a.prevRate !== null && a.prevRate > 0 ? a.curRate >= 2 * a.prevRate : a.count >= 5),
        )
        .sort((a, b) => (b.curRate ?? 0) - (a.curRate ?? 0))
        .slice(0, 2);
    }
    return Object.entries(curDefect)
      .map(([name, count]) => ({ name, count, prevCount: prevDefect[name] || 0, curShipped: null, curRate: null, prevRate: null }))
      .filter((a) => a.count >= 5 && a.count >= 2 * Math.max(a.prevCount, 1))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);
  }, [curDefect, prevDefect, shipIdx, prevShipIdx]);

  // 교환율/불량률 — 출고 데이터(shipIdx)가 로드된 뒤에만 계산 가능해서 별도 useMemo로 분리
  const { rateKpis, matchCoverage, topProductsWithRate } = useMemo(() => {
    if (!shipIdx) {
      return { rateKpis: null, matchCoverage: null, topProductsWithRate: topProducts };
    }
    const overall = computeRate(stats.jasa + stats.oebu, shipIdx.total.total);
    // 네이버페이 출고분은 카페24에 포함되므로 분자도 자사몰 쪽으로 옮겨 계산
    const jasaRate = computeRate(stats.jasaScoped, shipIdx.total.jasa);
    const oebuRate = computeRate(stats.oebuScoped, shipIdx.total.oebu);
    const defectRate = computeRate(productDefectTotal, shipIdx.total.total);

    const coverage = buildMatchCoverage(
      [...filteredData.jasa, ...filteredData.oebu, ...filteredData.bulryang],
      shipIdx,
    );

    const withRate = topProducts.map((p) => {
      const shipped = lookupProduct(shipIdx, p.name);
      const r = computeRate(p.count, shipped?.total ?? null, 0);
      return { ...p, rate: r.rate, shipped: r.shipped };
    });

    return {
      rateKpis: { overall, jasaRate, oebuRate, defectRate },
      matchCoverage: coverage,
      topProductsWithRate: withRate,
    };
  }, [shipIdx, stats, productDefectTotal, topProducts, filteredData]);

  if (loading && !data) return (
    <div className="flex h-[80vh] items-center justify-center text-indigo-600 font-bold animate-pulse">
      심층 분석 데이터 집계 중...
    </div>
  );

  const unshippedTotal = agingData.pending + agingData.waitingStock + agingData.notReceived;
  const KPI_DATA: {
    label: string; value: string; detail: string;
    color: 'indigo' | 'emerald' | 'orange' | 'rose' | 'slate';
    trend?: 'up' | 'down'; isAlert?: boolean;
  }[] = [
    { label: '전체 교환 접수', value: stats.total.toLocaleString(), detail: `전기 대비 ${stats.mom >= 0 ? '+' : ''}${stats.mom}%`, color: 'indigo', trend: stats.mom >= 0 ? 'up' : 'down' },
    { label: '자사몰 일반교환', value: stats.jasa.toLocaleString(), detail: `${Math.round((stats.jasa/stats.total)*100 || 0)}% 비중`, color: 'emerald' },
    { label: '외부몰 교환 전체', value: stats.oebu.toLocaleString(), detail: `${Math.round((stats.oebu/stats.total)*100 || 0)}% 비중`, color: 'orange' },
    { label: '불량교환 전체', value: stats.bulryang.toLocaleString(), detail: `${Math.round((stats.bulryang/stats.total)*100 || 0)}% 발생률`, color: 'rose', isAlert: true },
    { label: '미출고 합계', value: unshippedTotal.toLocaleString(), detail: `재고대기 ${agingData.waitingStock} · 미입고 ${agingData.notReceived}`, color: 'slate' },
  ];

  const OPS_DATA = [
    { label: '출고 리드타임 (중앙값)', value: opsData.leadMedian !== null ? `${opsData.leadMedian}일` : '-', detail: opsData.prevLeadMedian !== null ? `전기 ${opsData.prevLeadMedian}일` : '', good: opsData.leadMedian !== null && opsData.prevLeadMedian !== null && opsData.leadMedian <= opsData.prevLeadMedian },
    { label: '출고 처리율', value: `${opsData.shipRate}%`, detail: '출고일이 확정 날짜인 건 기준', good: opsData.shipRate >= 90 },
    { label: '회수 지연 (7일+)', value: `${opsData.recoveryOverdue}건`, detail: '자사몰·불량 기준, 미집화 상태', good: opsData.recoveryOverdue === 0 },
    { label: '교환 배송비 수취', value: `${opsData.totalFee.toLocaleString()}원`, detail: '조회 기간 전 채널 합계', good: true },
    { label: '반복교환 고객 (3회+)', value: `${opsData.repeatCustomers}명`, detail: '조회 기간 내 전 채널 기준', good: true },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full pb-20">
      {/* Header */}
      <section className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">전체 현황 Dashboard</h2>
          <p className="text-sm text-slate-400 font-bold mt-1 tracking-wide uppercase opacity-70">Logistics & CX Real-time Stream Analysis</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-4 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
             <DateFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
            <button onClick={() => reload()} className="p-2 hover:bg-slate-50 transition-colors border-l border-slate-100 ml-2">
              <Icon name="sync" className={loading ? 'animate-spin text-indigo-600' : 'text-slate-400'} />
            </button>
          </div>
          <MatchCoverageChip coverage={matchCoverage} failed={shipFailed} />
        </div>
      </section>

      {/* 품질 급증 경보 — 조건 충족 시에만 노출 */}
      {qualityAlerts.length > 0 && (
        <section className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-6 flex items-start gap-4">
          <div className="bg-rose-500 p-3 rounded-2xl shrink-0">
            <Icon name="warning" className="text-white text-2xl" />
          </div>
          <div>
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">품질 급증 경보</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {qualityAlerts.map((a, i) => (
                <p key={i} className="text-sm font-bold text-rose-700">
                  <span className="font-black">{a.name}</span> 불량 급증 —{' '}
                  {a.curRate !== null ? (
                    <>
                      불량률 {a.curRate.toFixed(2)}%
                      {a.prevRate !== null && a.prevRate > 0 && ` (전기 ${a.prevRate.toFixed(2)}%)`}
                      {' · '}{a.count}건 / 출고 {a.curShipped?.toLocaleString()}건
                    </>
                  ) : (
                    <>이번 기간 {a.count}건 (전기 {a.prevCount}건)</>
                  )}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 교환율 KPI — 출고량 대비 교환율. 출고 데이터 매칭 실패 시 카드 자체를 숨김(graceful degradation) */}
      {rateKpis && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            label="전사 교환율"
            value={rateKpis.overall.rate !== null ? `${rateKpis.overall.rate.toFixed(1)}%` : '—'}
            detail={`교환 ${(stats.jasa + stats.oebu).toLocaleString()}건 / 출고 ${(rateKpis.overall.shipped ?? 0).toLocaleString()}건`}
            tone="accent"
            accentColor="indigo"
          />
          <KpiCard
            label="자사몰 교환율"
            value={rateKpis.jasaRate.rate !== null ? `${rateKpis.jasaRate.rate.toFixed(1)}%` : '—'}
            detail={`교환 ${stats.jasaScoped.toLocaleString()}건 / 출고 ${(rateKpis.jasaRate.shipped ?? 0).toLocaleString()}건${stats.oebuJasaScoped > 0 ? ` (네이버페이 ${stats.oebuJasaScoped}건 포함)` : ''}`}
            accentColor="emerald"
          />
          <KpiCard
            label="외부몰 교환율"
            value={rateKpis.oebuRate.rate !== null ? `${rateKpis.oebuRate.rate.toFixed(1)}%` : '—'}
            detail={`교환 ${stats.oebuScoped.toLocaleString()}건 / 출고 ${(rateKpis.oebuRate.shipped ?? 0).toLocaleString()}건${stats.oebuJasaScoped > 0 ? ` (네이버페이 제외)` : ''}`}
            accentColor="orange"
          />
          <KpiCard
            label="불량률"
            value={rateKpis.defectRate.rate !== null ? `${rateKpis.defectRate.rate.toFixed(1)}%` : '—'}
            detail={`제품결함 ${productDefectTotal.toLocaleString()}건 / 출고 ${(rateKpis.defectRate.shipped ?? 0).toLocaleString()}건`}
            tone="alert"
            accentColor="rose"
          />
        </section>
      )}

      {/* KPI Section (건수) */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {KPI_DATA.map((kpi, idx) => (
          <KpiCard
            key={idx}
            label={kpi.label}
            value={kpi.value}
            detail={kpi.detail}
            tone={kpi.isAlert ? 'alert' : 'default'}
            trend={kpi.trend ? { direction: kpi.trend } : undefined}
            accentColor={kpi.color}
          />
        ))}
      </section>

      {/* 리스크 & 비용 지표 — 물류/재무/CX가 가져갈 핵심 운영지표 */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {OPS_DATA.map((m, idx) => (
          <KpiCard
            key={idx}
            variant="compact"
            label={m.label}
            value={m.value}
            detail={m.detail}
            tone={m.good ? 'default' : 'alert'}
          />
        ))}
      </section>

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* Daily Trend (8/12) */}
         <ChartCard
            className="lg:col-span-8"
            title="전체 출고 및 교환 추이"
            subtitle="Daily interaction metrics over selected period"
            legend={[
              { label: '자사몰', color: SERIES_COLORS.jasa },
              { label: '외부몰', color: SERIES_COLORS.oebu },
              { label: '불량', color: SERIES_COLORS.bulryang },
            ]}
            height={340}
         >
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                     <linearGradient id="fillJasa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SERIES_COLORS.jasa} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={SERIES_COLORS.jasa} stopOpacity={0} />
                     </linearGradient>
                     <linearGradient id="fillOebu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SERIES_COLORS.oebu} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={SERIES_COLORS.oebu} stopOpacity={0} />
                     </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis
                     dataKey="date" {...AXIS_PROPS} dy={10}
                     interval={Math.max(0, Math.ceil(chartData.length / 10) - 1)}
                  />
                  <YAxis {...AXIS_PROPS} width={32} allowDecimals={false} />
                  <Tooltip cursor={TOOLTIP_CURSOR} contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="jasa" name="자사몰" stroke={SERIES_COLORS.jasa} strokeWidth={3} fill="url(#fillJasa)" dot={false} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="oebu" name="외부몰" stroke={SERIES_COLORS.oebu} strokeWidth={3} fill="url(#fillOebu)" dot={false} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="bulryang" name="불량" stroke={SERIES_COLORS.bulryang} strokeWidth={2} fill="none" dot={false} activeDot={{ r: 4 }} />
               </AreaChart>
            </ResponsiveContainer>
         </ChartCard>

         {/* Share & Typing (4/12) */}
         <div className="lg:col-span-4 space-y-8">
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 h-full">
               <h4 className="text-lg font-black text-slate-900 mb-8 text-center uppercase tracking-tight">유형별 비교</h4>
               <div className="h-[250px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                           data={pieData}
                           innerRadius={70}
                           outerRadius={95}
                           paddingAngle={10}
                           dataKey="value"
                        >
                           {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip />
                     </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                     <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Total</p>
                     <p className="text-2xl font-black text-slate-900">{stats.total}</p>
                  </div>
               </div>
               <div className="mt-8 space-y-4">
                  {pieData.map((e, i) => (
                    <div key={i} className="flex justify-between items-center text-xs font-bold">
                       <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color }}></span>
                          <span className="text-slate-500">{e.name}</span>
                       </div>
                       <span className="text-slate-900">{Math.round((e.value/stats.total)*100)}%</span>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>

      {/* 교환율 관제 그래프 — KPI 날짜 필터와 무관하게 2024-05~현재 전체 히스토리 +
          과거 데이터(2024-07~2025-12)로 계산한 평균±2σ 밴드. 밴드 벗어나면 강조 표시. */}
      <ControlChart
        shipments={controlChartShip.shipments}
        exchangeHistory={exchangeHistory}
        liveDaily={liveDaily}
        jasaRows={data?.data.jasaMall || []}
        oebuRows={data?.data.oebuMall || []}
        bulryangRows={data?.data.bulryang || []}
      />

      {/* Analysis Widgets (Top Products & Aging) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
         {/* Top 5 Products */}
         <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
            <h4 className="text-base font-black text-slate-900 mb-8 border-b border-slate-50 pb-4">TOP 3 교환 발생 상품</h4>
            <div className="space-y-6">
               {topProductsWithRate.map((p, i) => (
                 <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                       <span className="text-lg font-black text-slate-200 group-hover:text-indigo-600 transition-colors">0{i+1}</span>
                       <div>
                          <p className="text-xs font-black text-slate-800 line-clamp-1 max-w-[180px]">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold tracking-tight mt-0.5">
                            전체 교환의 {p.share}%{p.defect > 0 && <span className="text-rose-500"> · 불량 {p.defect}건</span>}
                          </p>
                       </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                       <p className="text-sm font-black text-slate-900">{p.count}건</p>
                       {'rate' in p && <RateBadge rate={p.rate ?? null} exchanges={p.count} shipped={p.shipped} />}
                    </div>
                 </div>
               ))}
               {topProductsWithRate.length === 0 && <p className="text-center text-slate-300 py-10 font-bold italic">조회된 상품 데이터가 없습니다.</p>}
            </div>
         </div>

         {/* Aging Summary */}
         <div className="bg-slate-900 p-8 rounded-[32px] shadow-xl text-white relative overflow-hidden">
            <Icon name="history" className="absolute -right-10 -bottom-10 text-[200px] opacity-5 rotate-12" />
            <h4 className="text-base font-black mb-8 border-b border-white/10 pb-4 relative z-10">미처리 요약 (Aging)</h4>
            <div className="grid grid-cols-1 gap-6 relative z-10">
               {[
                 { label: '3 Days Aging', count: agingData.d3, color: 'emerald' },
                 { label: '5 Days Aging', count: agingData.d5, color: 'orange' },
                 { label: '7 Days+ Aging', count: agingData.d7, color: 'rose' },
               ].map((a, i) => (
                 <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <span className="text-xs font-bold opacity-70">{a.label}</span>
                    <div className="flex items-baseline gap-1">
                       <span className={`text-2xl font-black text-${a.color}-400`}>{a.count}</span>
                       <span className="text-[10px] font-bold opacity-50">건</span>
                    </div>
                 </div>
               ))}
            </div>
            <div className="mt-8 pt-6 border-t border-white/10 relative z-10">
               <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-4">미출고 상태 구성</p>
               <div className="space-y-3">
                 {[
                   { label: '단순 미출고', count: agingData.pending },
                   { label: '재고 입고 대기', count: agingData.waitingStock },
                   { label: '반품 미입고', count: agingData.notReceived },
                 ].map((s, i) => (
                   <div key={i} className="text-[11px] font-medium flex justify-between gap-2">
                      <span className="opacity-70">{s.label}</span>
                      <span className="text-indigo-400 shrink-0 font-black">{s.count}건</span>
                   </div>
                 ))}
               </div>
            </div>
         </div>

         {/* 부서별 현황 — 각 부서가 이 카드만 봐도 자기 몫을 가져가도록 */}
         <div className="bg-indigo-600 p-8 rounded-[32px] shadow-xl text-white flex flex-col justify-between">
            <div>
               <h4 className="text-base font-black mb-6">부서별 현황</h4>
               <div className="space-y-4">
                  <Link to="/defective-analysis" className="block bg-white/10 hover:bg-white/20 p-4 rounded-2xl transition-colors">
                     <p className="text-[10px] font-black opacity-60 uppercase mb-1.5">생산 / QC</p>
                     {deptSummary.topDefectProduct ? (
                        <p className="text-xs font-bold leading-relaxed">
                           제품결함 1위 — <span className="font-black">{deptSummary.topDefectProduct.name}</span> {deptSummary.topDefectProduct.count}건
                        </p>
                     ) : <p className="text-xs font-bold opacity-60">제품결함 데이터 없음</p>}
                  </Link>
                  <Link to="/oebu-exchange" className="block bg-white/10 hover:bg-white/20 p-4 rounded-2xl transition-colors">
                     <p className="text-[10px] font-black opacity-60 uppercase mb-1.5">물류</p>
                     <p className="text-xs font-bold leading-relaxed">
                        회수 지연 <span className="font-black">{opsData.recoveryOverdue}건</span> · 출고 리드타임 중앙값 <span className="font-black">{opsData.leadMedian !== null ? `${opsData.leadMedian}일` : '-'}</span>
                     </p>
                  </Link>
                  <Link to="/jasa-exchange" className="block bg-white/10 hover:bg-white/20 p-4 rounded-2xl transition-colors">
                     <p className="text-[10px] font-black opacity-60 uppercase mb-1.5">재무</p>
                     <p className="text-xs font-bold leading-relaxed">
                        교환 배송비 수취 <span className="font-black">{opsData.totalFee.toLocaleString()}원</span> · 무료교환 비중 <span className="font-black">{deptSummary.freeRate}%</span>
                     </p>
                  </Link>
               </div>
            </div>
            <div className="bg-white/10 p-4 rounded-2xl mt-8">
               <p className="text-[10px] font-black opacity-60 uppercase mb-2">Next Suggested Action</p>
               <p className="text-xs font-black">Aging 7일 이상 {agingData.d7}건 전수 조사 및 출고 독려</p>
            </div>
         </div>
      </div>
    </div>
  );
};
