import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '../components/ui/Icon';
import { DateFilter } from '../components/ui/DateFilter';
import { fetchDashboardData, type ExchangeData } from '../api/sheets';
import { DEFECT_CATEGORIES, classifyDefect, normalizeChannel, type DefectCategory } from '../lib/exchange';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// 불량 시트의 모든 행을 실제 사유값 기준으로 단일 분류.
// 제품 결함(생산/QC 액션) vs 운영·물류 오류(CX/물류 액션) vs 비불량(변심 등)을 분리해
// "진짜 품질 문제"가 얼마나 되는지 보여주는 것이 핵심.
export const DefectiveAnalysis: React.FC = () => {
  const [data, setData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const loadData = async (force = false) => {
    setLoading(true);
    try {
      const result = await fetchDashboardData(force);
      setData(result);
      if (!startDate || !endDate) {
        const dates = (result.data.bulryang || [])
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
    } catch (err: any) { console.error(err.message); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const { total, groupSummary, categorySummary, monthlyTrend, bigCategoryStats, channelDefects, topDefectiveItems } = useMemo(() => {
    const empty = {
      total: 0,
      groupSummary: { product: 0, ops: 0, nonDefect: 0, unknown: 0 },
      categorySummary: [] as (DefectCategory & { count: number; pct: number; topOptions: { label: string; count: number }[] })[],
      monthlyTrend: [] as any[],
      bigCategoryStats: [] as { name: string; count: number }[],
      channelDefects: [] as { name: string; count: number }[],
      topDefectiveItems: [] as { name: string; count: number; topReasons: { reason: string; count: number }[] }[],
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

    // Top 3 상품 — "제품 결함"으로 분류된 건만 (변심·전산오류 제외)
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
    const topDefectiveItems = Object.entries(itemMap)
      .map(([name, { count, reasons }]) => ({
        name, count,
        topReasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([reason, cnt]) => ({ reason, count: cnt })),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return { total, groupSummary, categorySummary, monthlyTrend, bigCategoryStats, channelDefects, topDefectiveItems };
  }, [data, startDate, endDate]);

  if (loading && !data) return (
    <div className="flex h-[80vh] items-center justify-center text-rose-600 font-black animate-pulse">품질 정밀 분석 데이터 집계 중...</div>
  );

  const GROUP_KPI = [
    { label: '불량시트 전체 접수', value: total, color: 'text-slate-900', desc: '조회 기간 내 접수 전체' },
    { label: '제품 결함', value: groupSummary.product, color: 'text-rose-600', desc: '원단·패드·봉제·오염 등 → 생산/QC 공유' },
    { label: '운영·물류 오류', value: groupSummary.ops, color: 'text-amber-600', desc: '전산오처리·내품오류·오출고 → 프로세스 개선' },
    { label: '비불량 (변심·착용후)', value: groupSummary.nonDefect, color: 'text-slate-400', desc: '불량 통계에서 제외해야 하는 건' },
    { label: '확인필요 (미분류)', value: groupSummary.unknown, color: 'text-indigo-600', desc: '사유 입력 필요 — 데이터 품질 지표' },
  ];

  const productDefectPct = total > 0 ? Math.round((groupSummary.product / total) * 100) : 0;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full pb-20">
      {/* ── 헤더 ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">주요 불량 이슈 분석</h2>
          <p className="text-sm text-slate-400 font-bold mt-1 uppercase tracking-widest opacity-70">Defect Root Cause & Product Correlation</p>
        </div>
        <div className="flex gap-2 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <DateFilter startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
          <button onClick={() => loadData(true)} className="p-2 hover:bg-slate-50 transition-colors border-l border-slate-100 ml-1">
            <Icon name="sync" className={loading ? 'animate-spin text-rose-600' : 'text-slate-400'} />
          </button>
        </div>
      </div>

      {/* ── 그룹 KPI: 진짜 불량 vs 운영 오류 vs 비불량 분리 ──── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {GROUP_KPI.map((k, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{k.label}</p>
            <p className={`text-3xl font-black ${k.color}`}>{k.value.toLocaleString()}<span className="text-xs opacity-40 ml-1">건</span></p>
            <p className="text-[10px] font-bold text-slate-400 mt-2 leading-relaxed">{k.desc}</p>
          </div>
        ))}
      </div>

      {/* ── 월별 추이 (스택) ─────────────────────────────────── */}
      <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
        <div className="mb-8">
          <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">월별 불량 접수 추이</h4>
          <p className="text-xs text-slate-400 font-bold mt-1">제품 결함이 늘고 있는지, 운영 오류가 늘고 있는지 구분해서 추적합니다 (전체 기간 기준)</p>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
              <Bar dataKey="product" name="제품 결함" stackId="a" fill="#e11d48" />
              <Bar dataKey="ops" name="운영·물류 오류" stackId="a" fill="#f59e0b" />
              <Bar dataKey="nonDefect" name="비불량(변심 등)" stackId="a" fill="#cbd5e1" />
              <Bar dataKey="unknown" name="확인필요" stackId="a" fill="#818cf8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

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

        {/* ── 오른쪽: Top 3 상품 (제품결함 기준) ──────────────── */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <div>
                <h4 className="font-black text-2xl text-slate-900 tracking-tight">제품결함 상위 상품 (Top 3)</h4>
                <p className="text-xs text-slate-400 font-bold mt-1">변심·전산오류를 제외한 순수 제품 결함 기준입니다. 생산/QC 팀 공유용.</p>
              </div>
              <div className="bg-rose-500 p-4 rounded-3xl shadow-lg shadow-rose-200">
                <Icon name="assignment_late" className="text-white text-3xl" />
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {topDefectiveItems.map((item, i) => (
                <div key={i} className="px-8 py-8 hover:bg-slate-50/40 transition-all group">
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-5 min-w-0">
                      <span className="text-5xl font-black text-slate-100 group-hover:text-rose-100 group-hover:scale-110 transition-all duration-500 italic shrink-0">0{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-base font-black text-slate-800 line-clamp-1 mb-1">{item.name}</p>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[10px] bg-rose-50 text-rose-500 px-2 py-0.5 rounded-md font-bold">제품결함 {item.count}건</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-3xl font-black text-rose-600">{item.count} <span className="text-xs text-slate-300 font-bold">건</span></p>
                      <div className="h-1.5 w-24 bg-slate-50 rounded-full overflow-hidden mt-1 ml-auto">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(item.count / topDefectiveItems[0].count) * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {item.topReasons.map((r, j) => {
                      const cat = classifyDefect(r.reason);
                      const bc = cat ? cat.color : '#94a3b8';
                      return (
                        <div key={j} className="rounded-2xl p-3 bg-slate-50 border border-transparent flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black" style={{ color: bc }}>#{j + 1}</span>
                            <span className="text-[10px] font-black truncate text-slate-600">{r.reason}</span>
                          </div>
                          <p className="text-xl font-black text-slate-800">{r.count}<span className="text-[10px] opacity-50 ml-0.5">건</span></p>
                          <div className="h-1 w-full bg-white/60 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ backgroundColor: bc, width: `${(r.count / item.topReasons[0].count) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {topDefectiveItems.length === 0 && (
                <p className="text-center py-20 text-slate-300 font-bold italic text-lg">조회 기간 내 제품결함 데이터가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
