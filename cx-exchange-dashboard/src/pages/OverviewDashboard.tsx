import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '../components/ui/Icon';
import { DateFilter } from '../components/ui/DateFilter';
import { fetchDashboardData, type ExchangeData } from '../api/sheets';
import { shipStatus, isShipped, leadTimeDays, median, toISODate } from '../lib/exchange';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export const OverviewDashboard: React.FC = () => {
  const [data, setData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = async (force = false) => {
    setLoading(true);
    try {
      const result = await fetchDashboardData(force);
      setData(result);
      
      if (!startDate || !endDate) {
        const allDates: string[] = [];
        Object.values(result.data).forEach((arr: any[]) => {
          (arr || []).forEach(row => {
            if (row['접수일']) {
              allDates.push(row['접수일'].replace(/\./g, '-'));
            }
          });
        });
        
        if (allDates.length > 0) {
          allDates.sort();
          const maxDateStr = allDates[allDates.length - 1];
          const maxDate = new Date(maxDateStr);
          const start = new Date(maxDate);
          start.setMonth(start.getMonth() - 1);
          
          setEndDate(maxDateStr);
          setStartDate(start.toISOString().split('T')[0]);
        }
      }
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const { stats, chartData, pieData, topProducts, agingData, opsData } = useMemo(() => {
    if (!data || !startDate || !endDate) return {
      filteredData: { jasa: [], bulryang: [], oebu: [] },
      stats: { jasa: 0, bulryang: 0, oebu: 0, total: 0, mom: 0 },
      chartData: [], pieData: [], topProducts: [],
      agingData: { d3: 0, d5: 0, d7: 0, waitingStock: 0, notReceived: 0, pending: 0 },
      opsData: { leadMedian: null as number | null, prevLeadMedian: null as number | null, shipRate: 0 }
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

    const statsObj = {
      jasa: jasa.length,
      bulryang: bulryang.length,
      oebu: oebu.length,
      total: currentTotal,
      mom
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
    const ops = {
      leadMedian: median(leadTimes),
      prevLeadMedian: median(prevLeadTimes),
      shipRate: allRows.length > 0 ? Math.round((shippedCount / allRows.length) * 100) : 0,
    };

    return { filteredData: { jasa, bulryang, oebu }, stats: statsObj, chartData: chartArr, pieData: pieArr, topProducts: topProdArr, agingData: agingMap, opsData: ops };
  }, [data, startDate, endDate]);

  if (loading && !data) return (
    <div className="flex h-[80vh] items-center justify-center text-indigo-600 font-bold animate-pulse">
      심층 분석 데이터 집계 중...
    </div>
  );

  const unshippedTotal = agingData.pending + agingData.waitingStock + agingData.notReceived;
  const KPI_DATA = [
    { label: '전체 교환 접수', value: stats.total.toLocaleString(), detail: `전기 대비 ${stats.mom >= 0 ? '+' : ''}${stats.mom}%`, color: 'indigo', trend: stats.mom >= 0 ? 'up' : 'down' },
    { label: '자사몰 일반교환', value: stats.jasa.toLocaleString(), detail: `${Math.round((stats.jasa/stats.total)*100 || 0)}% 비중`, color: 'emerald' },
    { label: '외부몰 교환 전체', value: stats.oebu.toLocaleString(), detail: `${Math.round((stats.oebu/stats.total)*100 || 0)}% 비중`, color: 'orange' },
    { label: '불량교환 전체', value: stats.bulryang.toLocaleString(), detail: `${Math.round((stats.bulryang/stats.total)*100 || 0)}% 발생률`, color: 'rose', isAlert: true },
    { label: '미출고 합계', value: unshippedTotal.toLocaleString(), detail: `재고대기 ${agingData.waitingStock} · 미입고 ${agingData.notReceived}`, color: 'slate' },
  ];

  const OPS_DATA = [
    { label: '출고 리드타임 (중앙값)', value: opsData.leadMedian !== null ? `${opsData.leadMedian}일` : '-', detail: opsData.prevLeadMedian !== null ? `전기 ${opsData.prevLeadMedian}일` : '', good: opsData.leadMedian !== null && opsData.prevLeadMedian !== null && opsData.leadMedian <= opsData.prevLeadMedian },
    { label: '출고 처리율', value: `${opsData.shipRate}%`, detail: '출고일이 확정 날짜인 건 기준', good: opsData.shipRate >= 90 },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full pb-20">
      {/* Header */}
      <section className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">전체 현황 Dashboard</h2>
          <p className="text-sm text-slate-400 font-bold mt-1 tracking-wide uppercase opacity-70">Logistics & CX Real-time Stream Analysis</p>
        </div>
        <div className="flex gap-4 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
           <DateFilter 
            startDate={startDate} 
            endDate={endDate} 
            onStartDateChange={setStartDate} 
            onEndDateChange={setEndDate} 
          />
          <button onClick={() => loadData(true)} className="p-2 hover:bg-slate-50 transition-colors border-l border-slate-100 ml-2">
            <Icon name="sync" className={loading ? 'animate-spin text-indigo-600' : 'text-slate-400'} />
          </button>
        </div>
      </section>

      {/* KPI Section */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {KPI_DATA.map((kpi, idx) => (
          <div key={idx} className="bg-white p-7 rounded-[24px] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
             <div className="relative z-10">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{kpi.label}</p>
               <h3 className={`text-3xl font-black ${kpi.isAlert ? 'text-rose-600' : 'text-slate-900'}`}>{kpi.value}</h3>
               <div className="mt-4 flex items-center gap-1.5">
                   {kpi.trend && (
                    <Icon name={kpi.trend === 'up' ? 'trending_up' : 'trending_down'} className={kpi.trend === 'up' ? 'text-emerald-500' : 'text-rose-500'} />
                  )}
                  <span className={`text-[10px] font-black ${kpi.trend === 'up' ? 'text-emerald-500' : kpi.trend === 'down' ? 'text-rose-500' : 'text-slate-400'}`}>
                    {kpi.detail}
                  </span>
               </div>
             </div>
             <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700 bg-${kpi.color}-500`}></div>
          </div>
        ))}
      </section>

      {/* Ops Metrics Strip — 채널 전체를 아우르는 운영지표만 남김 */}
      <section className="grid grid-cols-2 gap-6 max-w-[600px]">
        {OPS_DATA.map((m, idx) => (
          <div key={idx} className="bg-white px-6 py-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
              <p className={`text-2xl font-black ${m.good ? 'text-slate-900' : 'text-rose-600'}`}>{m.value}</p>
            </div>
            <p className="text-[10px] font-bold text-slate-400 text-right max-w-[120px]">{m.detail}</p>
          </div>
        ))}
      </section>

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* Daily Trend (8/12) */}
         <div className="lg:col-span-8 bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-10">
               <div>
                  <h4 className="text-lg font-black text-slate-900">전체 출고 및 교환 추이</h4>
                  <p className="text-xs text-slate-400 font-bold mt-1">Daily interaction metrics over selected period</p>
               </div>
               <div className="flex gap-6 uppercase text-[9px] font-black tracking-widest">
                  <div className="flex items-center gap-2 text-indigo-600">
                     <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> 자사몰
                  </div>
                  <div className="flex items-center gap-2 text-orange-500">
                     <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> 외부몰
                  </div>
                  <div className="flex items-center gap-2 text-rose-500">
                     <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> 불량
                  </div>
               </div>
            </div>
            <div className="h-[340px]">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                     <defs>
                        <linearGradient id="fillJasa" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                           <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="fillOebu" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                           <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis
                        dataKey="date" axisLine={false} tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} dy={10}
                        interval={Math.max(0, Math.ceil(chartData.length / 10) - 1)}
                     />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} width={32} allowDecimals={false} />
                     <Tooltip
                        cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                     />
                     <Area type="monotone" dataKey="jasa" name="자사몰" stroke="#6366f1" strokeWidth={3} fill="url(#fillJasa)" dot={false} activeDot={{ r: 5 }} />
                     <Area type="monotone" dataKey="oebu" name="외부몰" stroke="#f97316" strokeWidth={3} fill="url(#fillOebu)" dot={false} activeDot={{ r: 5 }} />
                     <Area type="monotone" dataKey="bulryang" name="불량" stroke="#ef4444" strokeWidth={2} fill="none" dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

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

      {/* Analysis Widgets (Top Products & Aging) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
         {/* Top 5 Products */}
         <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
            <h4 className="text-base font-black text-slate-900 mb-8 border-b border-slate-50 pb-4">TOP 3 교환 발생 상품</h4>
            <div className="space-y-6">
               {topProducts.map((p, i) => (
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
                    <div className="text-right">
                       <p className="text-sm font-black text-slate-900">{p.count}건</p>
                    </div>
                 </div>
               ))}
               {topProducts.length === 0 && <p className="text-center text-slate-300 py-10 font-bold italic">조회된 상품 데이터가 없습니다.</p>}
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

         {/* AI Summary Section (Repurposed for Status) */}
         <div className="bg-indigo-600 p-8 rounded-[32px] shadow-xl text-white flex flex-col justify-between">
            <div>
               <h4 className="text-base font-black mb-6">최근 리포트 요약</h4>
               <p className="text-xs font-bold leading-relaxed opacity-80">
                  현재 조회 기간 기준 총 {stats.total}건의 교환이 확인되었습니다. 
                  자사몰 비중이 {KPI_DATA[1].detail}로 집계되며, 7일 이상 지연된 건수가 {agingData.d7}건으로 우선 처리가 권장됩니다.
               </p>
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
