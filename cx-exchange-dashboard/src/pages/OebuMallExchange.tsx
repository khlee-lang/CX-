import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '../components/ui/Icon';
import { DateFilter } from '../components/ui/DateFilter';
import { fetchDashboardData, type ExchangeData } from '../api/sheets';
import { isShipped, leadTimeDays, median, normalizeChannel } from '../lib/exchange';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';

export const OebuMallExchange: React.FC = () => {
  const [exchangeData, setExchangeData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = async (force = false) => {
    setLoading(true);
    try {
      const data = await fetchDashboardData(force);
      setExchangeData(data);
      if (!startDate || !endDate) {
        const dates = (data.data.oebuMall || [])
          .map(r => r['접수일']?.replace(/\./g, '-'))
          .filter(Boolean).sort();
        if (dates.length > 0) {
          const maxDateStr = dates[dates.length - 1];
          const maxDate = new Date(maxDateStr);
          const start = new Date(maxDate);
          start.setMonth(start.getMonth() - 1);
          setEndDate(maxDateStr); setStartDate(start.toISOString().split('T')[0]);
        }
      }
    } catch (err: any) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const { channelStats, trendData, stats, optionAnalyses, productList } = useMemo(() => {
    if (!exchangeData?.data.oebuMall) return { channelStats: [], trendData: [], stats: { total:0, mom:0, defectiveRate:0 }, optionAnalyses: [], productList: [] };

    const filterFn = (row: any) => {
      const d = row['접수일']?.replace(/\./g, '-');
      return d && d >= startDate && d <= endDate;
    };

    const oebu = exchangeData.data.oebuMall.filter(filterFn);
    const bulryangRows = (exchangeData.data.bulryang || []).filter(filterFn);
    const bulryangIds = new Set(bulryangRows.map(r => r['주문번호']));

    // 직전 동일 기간 (실제 증감률 — 기존 하드코딩 15% 대체)
    const sDate = new Date(startDate); const eDate = new Date(endDate);
    const diffDays = Math.max(1, Math.ceil((eDate.getTime() - sDate.getTime()) / 86400000));
    const ps = new Date(sDate); ps.setDate(ps.getDate() - diffDays);
    const pe = new Date(sDate); pe.setDate(pe.getDate() - 1);
    const psStr = ps.toISOString().split('T')[0]; const peStr = pe.toISOString().split('T')[0];
    const prevCount = exchangeData.data.oebuMall.filter((row: any) => {
      const d = row['접수일']?.replace(/\./g, '-');
      return d && d >= psStr && d <= peStr;
    }).length;

    // 채널별 상세: 건수·처리율·리드타임·불량건 (채널 운영 담당자 공유용)
    const groups: Record<string, { count: number; shipped: number; leads: number[]; defects: number }> = {};
    const trends: Record<string, { date: string, simple: number, defective: number }> = {};
    const allProducts = new Set<string>();

    let defectiveCount = 0;
    oebu.forEach(row => {
      const channel = row['채널명']?.trim() || '기타';
      if (!groups[channel]) groups[channel] = { count: 0, shipped: 0, leads: [], defects: 0 };
      groups[channel].count++;
      if (isShipped(row)) groups[channel].shipped++;
      const lt = leadTimeDays(row);
      if (lt !== null) groups[channel].leads.push(lt);

      const pName = row['상품명']?.trim();
      if (pName) allProducts.add(pName);

      const d = row['접수일']?.replace(/\./g, '-');
      if (d) {
        if (!trends[d]) trends[d] = { date: d.substring(5), simple: 0, defective: 0 };
        if (bulryangIds.has(row['주문번호'])) {
           trends[d].defective++;
           defectiveCount++;
        } else {
           trends[d].simple++;
        }
      }
    });
    // 불량 시트의 외부몰 채널 건수를 채널별로 합산
    bulryangRows.forEach(r => {
      const ch = normalizeChannel(r['교환 형태 및 채널']);
      if (groups[ch]) groups[ch].defects++;
    });

    const statsArr = Object.entries(groups).map(([name, g]) => ({
      name,
      count: g.count,
      shipRate: g.count > 0 ? Math.round((g.shipped / g.count) * 100) : 0,
      leadMedian: median(g.leads),
      defects: g.defects,
    })).sort((a,b)=>b.count-a.count);
    const trendArr = Object.values(trends).sort((a,b)=>a.date.localeCompare(b.date));

    // Option Analysis
    let optionArr: any[] = [];
    if (selectedProduct) {
      const productExchanges = oebu.filter(row => row['상품명']?.trim() === selectedProduct);
      const swapMap: Record<string, number> = {};
      productExchanges.forEach(row => {
        const from = row['교환 전 옵션']?.trim() || '미지정';
        const to = row['교환 출고 옵션']?.trim() || '미지정';
        const key = `${from} → ${to}`;
        swapMap[key] = (swapMap[key] || 0) + 1;
      });
      optionArr = Object.entries(swapMap).map(([pair, count]) => {
        const [from, to] = pair.split(' → ');
        return { from, to, count };
      }).sort((a,b)=>b.count-a.count);
    }

    return {
      channelStats: statsArr, trendData: trendArr,
      stats: {
        total: oebu.length,
        mom: prevCount > 0 ? Math.round(((oebu.length - prevCount) / prevCount) * 100) : 0,
        defectiveRate: oebu.length > 0 ? Math.round((defectiveCount/oebu.length)*100) : 0
      },
      optionAnalyses: optionArr, productList: Array.from(allProducts).sort()
    };
  }, [exchangeData, startDate, endDate, selectedProduct]);

  if (loading && !exchangeData) return (
    <div className="flex h-[80vh] items-center justify-center text-orange-600 font-black animate-pulse">외부몰 멀티 채널 분석 중...</div>
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full pb-20 px-4 lg:px-0">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">외부몰 상세 분석</h2>
          <p className="text-sm text-slate-400 font-bold mt-1 uppercase tracking-widest opacity-70">Cross-Platform Marketplace Performance</p>
        </div>
        <div className="flex gap-4 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
           <DateFilter startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
           <button onClick={() => loadData(true)} className="p-2 hover:bg-slate-50 transition-colors border-l border-slate-100 ml-2">
            <Icon name="sync" className={loading ? 'animate-spin text-orange-600' : 'text-slate-400'} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between transition-hover hover:shadow-lg">
            <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">외부몰 전체 접수</p><h3 className="text-4xl font-black text-slate-900">{stats.total}</h3></div>
            <div className="bg-orange-50 p-3 rounded-2xl"><Icon name="storefront" className="text-orange-600 text-3xl" /></div>
         </div>
         <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between transition-hover hover:shadow-lg">
            <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">불량 교환 비중</p><h3 className="text-4xl font-black text-rose-600">{stats.defectiveRate}%</h3></div>
            <div className={`p-3 rounded-2xl ${stats.defectiveRate > 20 ? 'bg-rose-50' : 'bg-emerald-50'}`}><Icon name="warning" className="text-rose-600" /></div>
         </div>
         <div className="bg-slate-900 p-8 rounded-3xl shadow-xl flex items-center justify-between text-white">
            <div><p className="text-[10px] font-black opacity-50 uppercase mb-1">전기 대비 증감</p><h3 className={`text-4xl font-black ${stats.mom >= 0 ? 'text-orange-400' : 'text-emerald-400'}`}>{stats.mom >= 0 ? '+' : ''}{stats.mom}%</h3></div>
            <Icon name={stats.mom >= 0 ? 'trending_up' : 'trending_down'} className="text-3xl opacity-20" />
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-4 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm"><h4 className="font-black text-slate-900 text-lg mb-8 uppercase text-center">채널별 교환 점유율</h4><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={channelStats.slice(0, 5)} innerRadius={65} outerRadius={90} paddingAngle={8} dataKey="count">{channelStats.map((_e, i) => <Cell key={i} fill={['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'][i % 5]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></div>
         <div className="lg:col-span-8 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm"><div className="flex justify-between items-center mb-8"><h4 className="font-black text-slate-900 text-lg uppercase">주간 교환 발생 추이</h4></div><div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={trendData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} /><Tooltip /><Bar dataKey="simple" fill="#e2e8f0" stackId="a" /><Bar dataKey="defective" fill="#f97316" stackId="a" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
      </div>

      {/* 채널별 상세 테이블 — 채널 담당자/물류 공유용 */}
      <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
        <div className="mb-8">
          <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">채널별 운영 현황</h4>
          <p className="text-xs text-slate-400 font-bold mt-1">건수 · 출고 처리율 · 출고 리드타임 · 불량 접수를 채널 단위로 비교합니다</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="py-3 pr-4">채널</th>
                <th className="py-3 pr-4 text-right">접수 건수</th>
                <th className="py-3 pr-4 text-right">비중</th>
                <th className="py-3 pr-4 text-right">출고 처리율</th>
                <th className="py-3 pr-4 text-right">리드타임 (중앙값)</th>
                <th className="py-3 text-right">불량 접수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {channelStats.map((ch, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 pr-4 text-xs font-black text-slate-800">{ch.name}</td>
                  <td className="py-4 pr-4 text-right text-xs font-black text-slate-900">{ch.count.toLocaleString()}</td>
                  <td className="py-4 pr-4 text-right text-xs font-bold text-slate-500">{stats.total > 0 ? Math.round((ch.count / stats.total) * 100) : 0}%</td>
                  <td className={`py-4 pr-4 text-right text-xs font-black ${ch.shipRate >= 90 ? 'text-emerald-600' : 'text-rose-600'}`}>{ch.shipRate}%</td>
                  <td className="py-4 pr-4 text-right text-xs font-bold text-slate-700">{ch.leadMedian !== null ? `${ch.leadMedian}일` : '-'}</td>
                  <td className={`py-4 text-right text-xs font-black ${ch.defects > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{ch.defects > 0 ? `${ch.defects}건` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Option Analysis Section */}
      <div className="bg-orange-600 p-10 rounded-[48px] shadow-2xl text-white relative overflow-hidden transition-all duration-500">
         <Icon name="swap_horiz" className="absolute -right-10 -bottom-10 text-[200px] opacity-10 rotate-12" />
         <div className="relative z-10">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
               <div><h3 className="text-2xl font-black tracking-tight mb-2 uppercase">외부몰 상품별 옵션 교환 분석</h3><p className="text-xs font-bold opacity-70 uppercase tracking-widest">Identify marketplace-specific sizing trends</p></div>
               <div className="relative w-full lg:w-[400px]">
                  <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
                  <input type="text" placeholder="상품명을 검색하세요..." className="w-full bg-white/20 border border-white/30 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:outline-none focus:bg-white/30 transition-all placeholder:text-white/40" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  {searchTerm && !selectedProduct && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-orange-700 border border-white/10 rounded-2xl shadow-2xl max-h-[300px] overflow-y-auto z-50">
                       {productList.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase())).map((p, i) => (
                         <div key={i} className="p-4 hover:bg-orange-500 cursor-pointer text-xs font-bold border-b border-white/5 last:border-0" onClick={() => { setSelectedProduct(p); setSearchTerm(p); }}>{p}</div>
                       ))}
                    </div>
                  )}
               </div>
            </div>

            {selectedProduct ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {optionAnalyses.slice(0, 3).map((opt, i) => (
                   <div key={i} className="bg-white/10 border border-white/10 p-6 rounded-[32px] hover:bg-white/20 transition-all group">
                      <div className="flex justify-between items-center mb-6"><span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Option Flow 0{i+1}</span><span className="text-xl font-black">{opt.count} <span className="text-[10px] opacity-50">건</span></span></div>
                      <div className="flex items-center gap-4 justify-between">
                         <div className="flex-1 text-center"><p className="text-[10px] font-black opacity-50 uppercase mb-1">Old</p><p className="text-xs font-black line-clamp-1">{opt.from}</p></div>
                         <Icon name="arrow_forward" className="group-hover:translate-x-1 transition-transform" />
                         <div className="flex-1 text-center"><p className="text-[10px] font-black opacity-50 uppercase mb-1">New</p><p className="text-xs font-black line-clamp-1 text-white">{opt.to}</p></div>
                      </div>
                   </div>
                 ))}
              </div>
            ) : (
              <div className="text-center py-24 border-2 border-dashed border-white/20 rounded-[48px] opacity-50"><Icon name="search" className="text-6xl mb-4" /><p className="text-xs font-bold uppercase tracking-widest">상품을 선택하여 멀티 채널 옵션 분석을 시작하세요</p></div>
            )}
         </div>
      </div>

      <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full max-w-4xl">
            <div className="space-y-1"><h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">최다 채널</h5><p className="text-xl font-black text-slate-900">{channelStats[0]?.name || '-'}</p></div>
            <div className="space-y-1"><h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">불량 비중</h5><p className="text-xl font-black text-rose-600">{stats.defectiveRate}%</p></div>
            <div className="space-y-1"><h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">분석 상품 수</h5><p className="text-xl font-black text-slate-900">{productList.length}종</p></div>
         </div>
      </div>
    </div>
  );
};
