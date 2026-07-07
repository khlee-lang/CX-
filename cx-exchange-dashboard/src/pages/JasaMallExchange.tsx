import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '../components/ui/Icon';
import { DateFilter } from '../components/ui/DateFilter';
import { fetchDashboardData, type ExchangeData } from '../api/sheets';
import { isShipped, swapDirection, shippingFee as parseFee, type SwapDirection } from '../lib/exchange';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const JasaMallExchange: React.FC = () => {
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
        const dates = (data.data.jasaMall || [])
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

  const { chartData, stats, topItems, optionAnalyses, productList, swapStats } = useMemo(() => {
    if (!exchangeData?.data.jasaMall) return {
      chartData: [], stats: { total: 0, done: 0, mom: 0, freeRate: 0, preExchangeRate: 0, shippingFee: 0 },
      topItems: [], optionAnalyses: [], productList: [],
      swapStats: { sizeUp: 0, sizeDown: 0, colorOnly: 0, same: 0, both: 0, topSizeUp: [] as { name: string; count: number }[], topSizeDown: [] as { name: string; count: number }[] }
    };

    const filtered = exchangeData.data.jasaMall.filter(row => {
      const rowDate = row['접수일']?.replace(/\./g, '-');
      return rowDate && rowDate >= startDate && rowDate <= endDate;
    });

    // 직전 동일 기간 (실제 MoM 계산 — 기존 하드코딩 12% 대체)
    const sDate = new Date(startDate); const eDate = new Date(endDate);
    const diffDays = Math.max(1, Math.ceil((eDate.getTime() - sDate.getTime()) / 86400000));
    const ps = new Date(sDate); ps.setDate(ps.getDate() - diffDays);
    const pe = new Date(sDate); pe.setDate(pe.getDate() - 1);
    const psStr = ps.toISOString().split('T')[0]; const peStr = pe.toISOString().split('T')[0];
    const prevCount = exchangeData.data.jasaMall.filter(row => {
      const d = row['접수일']?.replace(/\./g, '-');
      return d && d >= psStr && d <= peStr;
    }).length;

    const dailyMap: Record<string, number> = {};
    const itemMap: Record<string, number> = {};
    const allProducts = new Set<string>();
    let done = 0, free = 0, pre = 0, fee = 0;

    // 사이즈 업/다운 방향 집계 (상품별 사이즈 가이드 개선 신호)
    const dirCount: Record<SwapDirection, number> = { sizeUp: 0, sizeDown: 0, colorOnly: 0, same: 0, both: 0, unknown: 0 };
    const sizeUpMap: Record<string, number> = {};
    const sizeDownMap: Record<string, number> = {};

    filtered.forEach(row => {
      const d = row['접수일']?.replace(/\./g, '-');
      if (d) dailyMap[d] = (dailyMap[d] || 0) + 1;
      if (isShipped(row)) done++;
      if (row['첫주문여부[자동]'] === '무료교환') free++;
      if ((row['교환형태'] || '').includes('선교환')) pre++;
      fee += parseFee(row);
      const name = row['상품명']?.trim();
      if (name) {
        itemMap[name] = (itemMap[name] || 0) + 1;
        allProducts.add(name);
      }
      const dir = swapDirection(row);
      dirCount[dir]++;
      if (name && dir === 'sizeUp') sizeUpMap[name] = (sizeUpMap[name] || 0) + 1;
      if (name && dir === 'sizeDown') sizeDownMap[name] = (sizeDownMap[name] || 0) + 1;
    });

    const topOf = (m: Record<string, number>) => Object.entries(m)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5);

    const chartArr = Object.entries(dailyMap)
      .map(([date, count]) => ({ date: date.substring(5), count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const topArr = Object.entries(itemMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 3);

    // Option Analysis for Selected Product
    let optionArr: any[] = [];
    if (selectedProduct) {
      const productExchanges = filtered.filter(row => row['상품명']?.trim() === selectedProduct);
      const swapMap: Record<string, number> = {};
      productExchanges.forEach(row => {
        const from = row['교환 전 옵션']?.trim() || '미지정';
        const to = row['교환 출고 옵션']?.trim() || '미지정';
        const key = `${from} → ${to}`;
        swapMap[key] = (swapMap[key] || 0) + 1;
      });
      optionArr = Object.entries(swapMap)
        .map(([pair, count]) => {
          const [from, to] = pair.split(' → ');
          return { from, to, count };
        })
        .sort((a, b) => b.count - a.count);
    }

    const total = filtered.length;
    return {
      chartData: chartArr,
      stats: {
        total, done,
        mom: prevCount > 0 ? Math.round(((total - prevCount) / prevCount) * 100) : 0,
        freeRate: total > 0 ? Math.round((free / total) * 100) : 0,
        preExchangeRate: total > 0 ? Math.round((pre / total) * 100) : 0,
        shippingFee: fee,
      },
      topItems: topArr,
      optionAnalyses: optionArr,
      productList: Array.from(allProducts).sort(),
      swapStats: { sizeUp: dirCount.sizeUp, sizeDown: dirCount.sizeDown, colorOnly: dirCount.colorOnly, same: dirCount.same, both: dirCount.both, topSizeUp: topOf(sizeUpMap), topSizeDown: topOf(sizeDownMap) }
    };
  }, [exchangeData, startDate, endDate, selectedProduct]);

  if (loading && !exchangeData) return (
    <div className="flex h-[80vh] items-center justify-center text-indigo-600 font-black animate-pulse">자사몰 교환 엔진 최적화 중...</div>
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full pb-20 px-4 lg:px-0">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">자사몰 교환 데이터 분석</h2>
          <p className="text-sm text-slate-400 font-bold mt-1 uppercase tracking-widest opacity-70">Official Site Exchange Intelligence</p>
        </div>
        <div className="flex gap-4 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
           <DateFilter startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
           <button onClick={() => loadData(true)} className="p-2 hover:bg-slate-50 transition-colors border-l border-slate-100 ml-2">
            <Icon name="sync" className={loading ? 'animate-spin text-indigo-600' : 'text-slate-400'} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-indigo-600 text-white p-8 rounded-[32px] shadow-lg shadow-indigo-100 relative overflow-hidden">
             <div className="relative z-10">
               <p className="text-xs font-black opacity-60 uppercase mb-2">자사몰 총 접수</p>
               <h3 className="text-5xl font-black">{stats.total} <span className="text-sm font-bold opacity-60 text-indigo-200">건</span></h3>
               <p className="text-[11px] font-black mt-3 opacity-80">전기 대비 {stats.mom >= 0 ? '+' : ''}{stats.mom}%</p>
             </div>
             <Icon name="verified" className="absolute -right-6 -bottom-6 text-[150px] opacity-10 rotate-12" />
           </div>
           
           <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 text-center">교환 처리 효율</h4>
              <div className="flex flex-col items-center">
                 <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                       <circle cx="56" cy="56" r="48" fill="transparent" stroke="#f8fafc" strokeWidth="10" />
                       <circle cx="56" cy="56" r="48" fill="transparent" stroke="#6366f1" strokeWidth="10" 
                         strokeDasharray={301.6} 
                         strokeDashoffset={301.6 * (1 - (stats.total > 0 ? stats.done / stats.total : 0))}
                         className="transition-all duration-1000"
                       />
                    </svg>
                    <div className="absolute text-center">
                       <span className="text-2xl font-black text-slate-900 block leading-none">
                         {stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%
                       </span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-3 bg-white p-10 rounded-[32px] border border-slate-100 shadow-sm">
           <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-8">자사몰 교환 접수 추이</h4>
           <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={4} fill="url(#colorCount)" dot={{ r: 4, fill: '#6366f1' }} />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* 정책/비용 지표 — CS비용·배송비 정책 판단용 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: '무료교환 비중', value: `${stats.freeRate}%`, detail: '첫 주문 무료교환 정책 적용' },
          { label: '입금요청 비중', value: `${100 - stats.freeRate}%`, detail: '고객 배송비 부담 건' },
          { label: '선교환 비중', value: `${stats.preExchangeRate}%`, detail: '회수 전 선출고 — 물류 리스크 지표' },
          { label: '교환 배송비 수취액', value: `${stats.shippingFee.toLocaleString()}원`, detail: '조회 기간 내 택배비 합계' },
        ].map((m, i) => (
          <div key={i} className="bg-white px-6 py-5 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
            <p className="text-2xl font-black text-slate-900">{m.value}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">{m.detail}</p>
          </div>
        ))}
      </div>

      {/* 사이즈 교환 방향 분석 — MD/기획팀: 사이즈 가이드 개선 신호 */}
      <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">사이즈 교환 방향 분석</h4>
            <p className="text-xs text-slate-400 font-bold mt-1">사이즈업이 많은 상품은 "작게 나옴", 사이즈다운이 많으면 "크게 나옴" 신호 → 사이즈 가이드/그레이딩 개선에 활용</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {[
            { label: '사이즈 업', value: swapStats.sizeUp, color: 'text-indigo-600 bg-indigo-50' },
            { label: '사이즈 다운', value: swapStats.sizeDown, color: 'text-orange-600 bg-orange-50' },
            { label: '색상만 변경', value: swapStats.colorOnly, color: 'text-emerald-600 bg-emerald-50' },
            { label: '색상+사이즈 변경', value: swapStats.both, color: 'text-slate-600 bg-slate-50' },
            { label: '동일 옵션 재출고', value: swapStats.same, color: 'text-rose-600 bg-rose-50' },
          ].map((m, i) => (
            <div key={i} className={`rounded-2xl p-5 text-center ${m.color.split(' ')[1]}`}>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
              <p className={`text-3xl font-black ${m.color.split(' ')[0]}`}>{m.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            { title: '사이즈업 TOP 5 (작게 나온다는 신호)', items: swapStats.topSizeUp, color: '#6366f1' },
            { title: '사이즈다운 TOP 5 (크게 나온다는 신호)', items: swapStats.topSizeDown, color: '#f97316' },
          ].map((col, i) => (
            <div key={i} className="bg-slate-50/60 rounded-3xl p-6">
              <p className="text-xs font-black text-slate-500 uppercase tracking-tight mb-4">{col.title}</p>
              <div className="space-y-3">
                {col.items.map((it, j) => (
                  <div key={j} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black shrink-0" style={{ color: col.color }}>#{j + 1}</span>
                      <span className="text-xs font-bold text-slate-700 truncate cursor-pointer hover:underline" onClick={() => { setSelectedProduct(it.name); setSearchTerm(it.name); }}>{it.name}</span>
                    </div>
                    <span className="text-xs font-black shrink-0" style={{ color: col.color }}>{it.count}건</span>
                  </div>
                ))}
                {col.items.length === 0 && <p className="text-xs text-slate-300 italic">데이터 없음</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Option Analysis Section */}
      <div className="bg-slate-900 p-10 rounded-[48px] shadow-2xl text-white relative overflow-hidden">
         <Icon name="compare_arrows" className="absolute -right-10 -bottom-10 text-[200px] opacity-5 rotate-12" />
         <div className="relative z-10">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
               <div>
                  <h3 className="text-2xl font-black tracking-tight mb-2 uppercase">상품별 옵션 교환 분석</h3>
                  <p className="text-xs font-bold opacity-50 uppercase tracking-widest">Identify sizing patterns & customer preferences</p>
               </div>
               <div className="relative w-full lg:w-[400px]">
                  <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="상품명을 입력하여 옵션 이동을 확인하세요..." 
                    className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:outline-none focus:bg-white/20 focus:scale-105 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && !selectedProduct && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl max-h-[300px] overflow-y-auto z-50">
                       {productList.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase())).map((p, i) => (
                         <div 
                           key={i} 
                           className="p-4 hover:bg-indigo-600 cursor-pointer text-xs font-bold border-b border-white/5 last:border-0 transition-colors"
                           onClick={() => { setSelectedProduct(p); setSearchTerm(p); }}
                         >
                           {p}
                         </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>

            {selectedProduct ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {optionAnalyses.slice(0, 3).map((opt, i) => (
                   <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-[32px] hover:bg-white/10 transition-all group">
                      <div className="flex justify-between items-center mb-6">
                         <span className="bg-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/50">Top Swap 0{i+1}</span>
                         <span className="text-xl font-black text-indigo-400">{opt.count} <span className="text-[10px] opacity-50">건</span></span>
                      </div>
                      <div className="flex items-center gap-4 justify-between">
                         <div className="flex-1 text-center">
                            <p className="text-[10px] font-black opacity-40 uppercase mb-1">Before</p>
                            <p className="text-xs font-black line-clamp-1">{opt.from}</p>
                         </div>
                         <Icon name="east" className="text-indigo-600 group-hover:translate-x-1 transition-transform" />
                         <div className="flex-1 text-center">
                            <p className="text-[10px] font-black opacity-40 uppercase mb-1">After</p>
                            <p className="text-xs font-black text-indigo-400 line-clamp-1">{opt.to}</p>
                         </div>
                      </div>
                      <div className="mt-6 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${(opt.count/optionAnalyses[0].count)*100}%` }}></div>
                      </div>
                   </div>
                 ))}
                 {optionAnalyses.length === 0 && (
                   <div className="col-span-full py-20 text-center opacity-30 italic font-bold">해당 상품의 옵션 교환 데이터가 부족합니다.</div>
                 )}
              </div>
            ) : (
              <div className="text-center py-24 border-2 border-dashed border-white/10 rounded-[48px]">
                 <Icon name="search" className="text-6xl opacity-10 mb-6" />
                 <p className="text-sm font-black opacity-30 uppercase tracking-widest">분석할 상품을 검색창에서 선택해 주세요</p>
              </div>
            )}
         </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm lg:col-span-1">
            <h4 className="font-black text-slate-900 uppercase tracking-tight mb-8 border-b border-slate-50 pb-4">전체 교환 랭킹 TOP 3</h4>
            <div className="space-y-6">
               {topItems.map((item, i) => (
                 <div key={i} className="flex items-center justify-between group cursor-pointer" onClick={() => { setSelectedProduct(item.name); setSearchTerm(item.name); }}>
                    <div className="flex items-center gap-4">
                       <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">0{i+1}</div>
                       <div><p className="text-xs font-black text-slate-800 line-clamp-1 max-w-[180px]">{item.name}</p></div>
                    </div>
                    <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl">{item.count}</span>
                 </div>
               ))}
            </div>
         </div>
         <div className="lg:col-span-2 bg-slate-50 p-10 rounded-[40px] border border-slate-100 flex items-center justify-center text-center">
            <div className="max-w-lg">
               <h4 className="text-2xl font-black text-slate-900 mb-4 tracking-tight uppercase">Decision Intelligence</h4>
               <p className="text-sm text-slate-500 font-medium leading-relaxed">
                 특정 상품의 교환이 특정 사이즈/컬러에 집중된다면 **상품 사이즈 가이드 수정**이나 **품질 검수 강화**가 필요함을 의미합니다. 위 분석 위젯으로 고객의 실제 선호 변화를 트래킹하세요.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};
