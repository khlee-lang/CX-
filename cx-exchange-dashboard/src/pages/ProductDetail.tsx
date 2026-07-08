import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '../components/ui/Icon';
import { DateFilter } from '../components/ui/DateFilter';
import { fetchDashboardData, type ExchangeData } from '../api/sheets';
import { normalizeChannel, swapDirection, classifyDefect, leadTimeDays, median } from '../lib/exchange';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const getWeekStr = (d: Date) => {
  const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dCopy.setUTCDate(dCopy.getUTCDate() + 4 - (dCopy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dCopy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${String(dCopy.getUTCMonth() + 1).padStart(2, '0')}/${String(dCopy.getUTCDate()).padStart(2, '0')} (W${weekNo})`;
};

export const ProductDetail: React.FC = () => {
  const [data, setData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = async (force = false) => {
    setLoading(true);
    try {
      const result = await fetchDashboardData(force);
      setData(result);
      if (!startDate || !endDate) {
        const allDates: string[] = [];
        [...(result.data.jasaMall || []), ...(result.data.oebuMall || []), ...(result.data.bulryang || [])].forEach(r => {
          if (r['접수일']) allDates.push(r['접수일'].replace(/\./g, '-'));
        });
        if (allDates.length > 0) {
          allDates.sort();
          const maxDateStr = allDates[allDates.length - 1];
          const start = new Date(maxDateStr);
          start.setMonth(start.getMonth() - 1);
          setEndDate(maxDateStr);
          setStartDate(start.toISOString().split('T')[0]);
        }
      }
    } catch (err: any) { console.error(err.message); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const productList = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    [...(data.data.jasaMall || []), ...(data.data.oebuMall || []), ...(data.data.bulryang || [])].forEach(r => {
      const name = r['상품명']?.trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [data]);

  const analysis = useMemo(() => {
    if (!data || !selectedProduct || !startDate || !endDate) return null;

    const inRange = (r: any) => {
      const d = r['접수일']?.replace(/\./g, '-');
      return d && d >= startDate && d <= endDate;
    };

    const allJasa = (data.data.jasaMall || []).filter(inRange);
    const allOebu = (data.data.oebuMall || []).filter(inRange);
    const allBul = (data.data.bulryang || []).filter(inRange);
    const totalAll = allJasa.length + allOebu.length + allBul.length;

    const jasa = allJasa.filter(r => r['상품명']?.trim() === selectedProduct);
    const oebu = allOebu.filter(r => r['상품명']?.trim() === selectedProduct);
    const bul = allBul.filter(r => r['상품명']?.trim() === selectedProduct);
    const allRows = [...jasa, ...oebu, ...bul];
    const total = allRows.length;

    // 채널별 발생 비중 (자사몰 / 외부몰 채널명별 / 불량)
    const channelMap: Record<string, number> = {};
    if (jasa.length) channelMap['자사몰'] = jasa.length;
    oebu.forEach(r => {
      const ch = normalizeChannel(r['채널명']);
      channelMap[ch] = (channelMap[ch] || 0) + 1;
    });
    if (bul.length) channelMap['불량'] = bul.length;
    const channelArr = Object.entries(channelMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // 옵션 교환 흐름 TOP5 (자사몰+외부몰 통합, 불량은 옵션 유지 교환이 대부분이라 제외)
    const swapMap: Record<string, number> = {};
    [...jasa, ...oebu].forEach(r => {
      const from = r['교환 전 옵션']?.trim() || '미지정';
      const to = r['교환 출고 옵션']?.trim() || '미지정';
      const key = `${from} → ${to}`;
      swapMap[key] = (swapMap[key] || 0) + 1;
    });
    const topSwaps = Object.entries(swapMap)
      .map(([pair, count]) => { const [from, to] = pair.split(' → '); return { from, to, count }; })
      .sort((a, b) => b.count - a.count).slice(0, 5);

    // 사이즈업/다운 요약
    const dirCount = { sizeUp: 0, sizeDown: 0, colorOnly: 0, same: 0, both: 0, unknown: 0 };
    [...jasa, ...oebu].forEach(r => { dirCount[swapDirection(r)]++; });

    // 불량 유형 분포
    const defectByCat: Record<string, { count: number; color: string; name: string }> = {};
    let unclassified = 0;
    bul.forEach(r => {
      const cat = classifyDefect(r['불량 사유']);
      if (!cat) { unclassified++; return; }
      if (!defectByCat[cat.key]) defectByCat[cat.key] = { count: 0, color: cat.color, name: cat.name };
      defectByCat[cat.key].count++;
    });
    const defectArr = Object.values(defectByCat).sort((a, b) => b.count - a.count);
    const topDefectReasons = (() => {
      const m: Record<string, number> = {};
      bul.forEach(r => { const reason = r['불량 사유']?.trim() || '미분류'; m[reason] = (m[reason] || 0) + 1; });
      return Object.entries(m).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    })();

    // 리드타임 (중앙값 + 최근 8주 추이)
    const leadTimes = allRows.map(leadTimeDays).filter((v): v is number => v !== null);
    const weekMap: Record<string, number[]> = {};
    allRows.forEach(r => {
      const lt = leadTimeDays(r);
      if (lt === null) return;
      const d = r['접수일']?.replace(/\./g, '-');
      if (!d) return;
      const wk = getWeekStr(new Date(d));
      if (!weekMap[wk]) weekMap[wk] = [];
      weekMap[wk].push(lt);
    });
    const weeklyTrend = Object.entries(weekMap)
      .map(([week, arr]) => ({ week, leadTime: median(arr) || 0 }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-8);

    // 대분류/SKU 정보 + 옵션별 재고
    const invRows = (data.data.inventory || []).filter(r => (r['ITEM'] || '').trim() === selectedProduct);
    const category = invRows.find(r => r['대분류'])?.['대분류'] || '-';
    const stockOptions = invRows
      .map(r => ({
        option: `${r['COLOR'] || ''} / ${r['SIZE'] || ''}`.trim(),
        stock: parseInt((r['재고'] || '0').toString().replace(/,/g, ''), 10) || 0,
        sku: r['SKU'] || '',
      }))
      .filter(o => o.sku)
      .sort((a, b) => a.stock - b.stock);

    return {
      total, totalAll,
      share: totalAll > 0 ? Math.round((total / totalAll) * 100 * 10) / 10 : 0,
      channelArr, topSwaps, dirCount,
      defectArr, unclassified, topDefectReasons, defectRate: total > 0 ? Math.round((bul.length / total) * 100) : 0,
      leadMedian: median(leadTimes), weeklyTrend,
      category, skuCount: invRows.length, stockOptions,
    };
  }, [data, selectedProduct, startDate, endDate]);

  if (loading && !data) return (
    <div className="flex h-[80vh] items-center justify-center text-indigo-600 font-black animate-pulse">상품별 심층 분석 데이터 집계 중...</div>
  );

  const PIE_COLORS = ['#6366f1', '#f97316', '#10b981', '#0ea5e9', '#f43f5e', '#a855f7'];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full pb-20">
      {/* 헤더 */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">상품별 상세 분석</h2>
          <p className="text-sm text-slate-400 font-bold mt-1 uppercase tracking-widest opacity-70">Product-Level Exchange Deep Dive</p>
        </div>
        <div className="flex gap-2 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <DateFilter startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
          <button onClick={() => loadData(true)} className="p-2 hover:bg-slate-50 transition-colors border-l border-slate-100 ml-1">
            <Icon name="sync" className={loading ? 'animate-spin text-indigo-600' : 'text-slate-400'} />
          </button>
        </div>
      </div>

      {/* 검색창 */}
      <div className="bg-slate-900 p-8 rounded-[40px] shadow-xl relative">
        <div className="relative max-w-2xl mx-auto">
          <Icon name="search" className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="상품명을 검색하세요 (예: 쿨핏 브라 볼륨핏)..."
            className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-white placeholder:text-slate-400 focus:outline-none focus:bg-white/20 transition-all"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setSelectedProduct(null); }}
          />
          {searchTerm && !selectedProduct && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl max-h-[300px] overflow-y-auto z-50">
              {productList.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 30).map((p, i) => (
                <div key={i} className="p-4 hover:bg-indigo-600 cursor-pointer text-xs font-bold text-white border-b border-white/5 last:border-0 transition-colors"
                  onClick={() => { setSelectedProduct(p); setSearchTerm(p); }}>
                  {p}
                </div>
              ))}
              {productList.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                <div className="p-4 text-xs text-slate-400 italic">일치하는 상품이 없습니다.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {!selectedProduct || !analysis ? (
        <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-[48px]">
          <Icon name="search" className="text-6xl opacity-10 mb-6" />
          <p className="text-sm font-black text-slate-300 uppercase tracking-widest">분석할 상품을 검색창에서 선택해 주세요</p>
        </div>
      ) : (
        <>
          {/* 히어로 + KPI */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
              <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded mb-2">{analysis.category}</span>
              <h3 className="text-xl font-black tracking-tight mb-1">{selectedProduct}</h3>
              <p className="text-xs text-slate-400 font-bold mb-6">SKU {analysis.skuCount}종 관리 중</p>
              <div className="flex gap-4">
                <div className="px-4 py-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">조회기간 교환건수</p>
                  <p className="text-xl font-black">{analysis.total.toLocaleString()}<span className="text-xs font-normal ml-1">건</span></p>
                </div>
                <div className="px-4 py-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">전체 교환 대비 비중</p>
                  <p className="text-xl font-black text-indigo-600">{analysis.share}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center"><Icon name="report_problem" className="text-rose-600" /></span>
              </div>
              <p className="text-sm font-medium text-slate-500 mb-1">불량 비중</p>
              <h4 className="text-3xl font-black">{analysis.defectRate}%</h4>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center"><Icon name="schedule" className="text-emerald-600" /></span>
              </div>
              <p className="text-sm font-medium text-slate-500 mb-1">출고 리드타임 중앙값</p>
              <h4 className="text-3xl font-black">{analysis.leadMedian !== null ? `${analysis.leadMedian}일` : '-'}</h4>
            </div>
          </div>

          {/* 사이즈 방향 + 채널 비중 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
              <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-6">사이즈 교환 방향</h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: '사이즈 업', value: analysis.dirCount.sizeUp, color: 'text-indigo-600 bg-indigo-50' },
                  { label: '사이즈 다운', value: analysis.dirCount.sizeDown, color: 'text-orange-600 bg-orange-50' },
                  { label: '색상만 변경', value: analysis.dirCount.colorOnly, color: 'text-emerald-600 bg-emerald-50' },
                  { label: '색상+사이즈', value: analysis.dirCount.both, color: 'text-slate-600 bg-slate-50' },
                  { label: '동일 재출고', value: analysis.dirCount.same, color: 'text-rose-600 bg-rose-50' },
                ].map((m, i) => (
                  <div key={i} className={`rounded-2xl p-4 text-center ${m.color.split(' ')[1]}`}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
                    <p className={`text-2xl font-black ${m.color.split(' ')[0]}`}>{m.value}</p>
                  </div>
                ))}
              </div>
              {analysis.dirCount.sizeUp + analysis.dirCount.sizeDown > 0 && (
                <p className="mt-6 text-[11px] text-slate-400 leading-relaxed">
                  <span className="font-bold text-indigo-600">인사이트: </span>
                  {analysis.dirCount.sizeUp > analysis.dirCount.sizeDown
                    ? '사이즈업이 더 많음 — "작게 나온다"는 피드백일 가능성.'
                    : analysis.dirCount.sizeDown > analysis.dirCount.sizeUp
                    ? '사이즈다운이 더 많음 — "크게 나온다"는 피드백일 가능성.'
                    : '사이즈업/다운이 비슷한 비중.'}
                </p>
              )}
            </div>
            <div className="lg:col-span-5 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
              <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-6 text-center">채널별 발생 비중</h4>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analysis.channelArr} innerRadius={55} outerRadius={80} paddingAngle={6} dataKey="count">
                      {analysis.channelArr.map((_e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {analysis.channelArr.map((c, i) => (
                  <div key={i} className="flex justify-between items-center text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                      <span className="text-slate-500">{c.name}</span>
                    </div>
                    <span className="text-slate-900">{c.count}건</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 옵션 교환 흐름 */}
          <div className="bg-indigo-600 p-10 rounded-[48px] shadow-2xl text-white relative overflow-hidden">
            <Icon name="swap_horiz" className="absolute -right-10 -bottom-10 text-[200px] opacity-10 rotate-12" />
            <div className="relative z-10">
              <h3 className="text-2xl font-black tracking-tight mb-1 uppercase">옵션 교환 흐름 TOP5</h3>
              <p className="text-xs font-bold opacity-70 uppercase tracking-widest mb-8">자사몰 + 외부몰 통합</p>
              {analysis.topSwaps.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {analysis.topSwaps.map((opt, i) => (
                    <div key={i} className="bg-white/10 border border-white/10 p-6 rounded-[32px]">
                      <div className="flex justify-between items-center mb-6">
                        <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Top {i + 1}</span>
                        <span className="text-xl font-black">{opt.count} <span className="text-[10px] opacity-50">건</span></span>
                      </div>
                      <div className="flex items-center gap-4 justify-between">
                        <div className="flex-1 text-center"><p className="text-[10px] font-black opacity-50 uppercase mb-1">Before</p><p className="text-xs font-black line-clamp-1">{opt.from}</p></div>
                        <Icon name="east" />
                        <div className="flex-1 text-center"><p className="text-[10px] font-black opacity-50 uppercase mb-1">After</p><p className="text-xs font-black line-clamp-1">{opt.to}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 opacity-40 italic font-bold">옵션 교환 데이터가 없습니다.</div>
              )}
            </div>
          </div>

          {/* 불량 유형 분포 */}
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-6">불량 유형 분포</h4>
            {analysis.defectArr.length === 0 && analysis.unclassified === 0 ? (
              <p className="text-center py-12 text-slate-300 font-bold italic">조회 기간 내 불량 이력이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {analysis.defectArr.map((cat, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-700">{cat.name}</span>
                        <span style={{ color: cat.color }}>{cat.count}건</span>
                      </div>
                      <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ backgroundColor: cat.color, width: `${(cat.count / (analysis.defectArr[0]?.count || 1)) * 100}%` }}></div>
                      </div>
                    </div>
                  ))}
                  {analysis.unclassified > 0 && (
                    <p className="text-[11px] text-slate-400 italic">확인필요/미분류 {analysis.unclassified}건 별도</p>
                  )}
                </div>
                <div className="bg-slate-50 rounded-2xl p-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">주요 불량 사유 TOP5</p>
                  <div className="space-y-3">
                    {analysis.topDefectReasons.map((r, i) => (
                      <div key={i} className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-600">#{i + 1} {r.reason}</span>
                        <span className="text-rose-600">{r.count}건</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 리드타임 추이 */}
          <div className="bg-white p-10 rounded-[32px] border border-slate-100 shadow-sm">
            <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-8">출고 리드타임 추이 (최근 8주)</h4>
            {analysis.weeklyTrend.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analysis.weeklyTrend}>
                    <defs>
                      <linearGradient id="colorLead" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                    <Area type="monotone" dataKey="leadTime" name="리드타임(일)" stroke="#10b981" strokeWidth={3} fill="url(#colorLead)" dot={{ r: 3, fill: '#10b981' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-12 text-slate-300 font-bold italic">리드타임을 계산할 출고 완료 건이 없습니다.</p>
            )}
          </div>

          {/* 옵션별 재고 */}
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-6">옵션별 현재 재고</h4>
            {analysis.stockOptions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-3 pr-4">옵션 (컬러/사이즈)</th>
                      <th className="py-3 pr-4">SKU</th>
                      <th className="py-3 text-right">재고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analysis.stockOptions.map((o, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-4 text-xs font-bold text-slate-800">{o.option || '-'}</td>
                        <td className="py-3 pr-4 text-xs font-mono text-slate-400">{o.sku}</td>
                        <td className="py-3 text-right">
                          <span className={`text-xs font-black px-2 py-1 rounded-lg ${o.stock < 100 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-700'}`}>
                            {o.stock.toLocaleString()}개{o.stock < 100 && ' · LOW'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-12 text-slate-300 font-bold italic">재고관리 시트에서 이 상품의 옵션 정보를 찾을 수 없습니다.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
