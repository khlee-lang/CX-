import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '../components/ui/Icon';
import { DateFilter } from '../components/ui/DateFilter';
import { fetchDashboardData, type ExchangeData } from '../api/sheets';

// ── 불량 유형 정의 (기타 제외) ──────────────────────────────────
const DEFECT_CATEGORIES = [
  {
    key: 'contamination',
    name: '오염/이염',
    color: '#f43f5e',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-600',
    borderColor: 'border-rose-200',
    keywords: ['오염', '이물질'],
  },
  {
    key: 'sewing',
    name: '봉제/마감/기능',
    color: '#3525cd',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    borderColor: 'border-indigo-200',
    keywords: ['봉제', '사이즈', '부자재', '지퍼', '후크', '스트랩', '따가움', '올트임'],
  },
  {
    key: 'fabric',
    name: '원단/패드 불량',
    color: '#006e4b',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    keywords: ['원단', '올트임', '패드', '접착'],
  },
];

const ALL_DEFECT_KEYWORDS = DEFECT_CATEGORIES.flatMap(c => c.keywords);


// ── 컴포넌트 ───────────────────────────────────────────────────
export const DefectiveAnalysis: React.FC = () => {
  const [data, setData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // 어떤 유형별 카드가 펼쳐져 있는지
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchDashboardData();
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

  const { filteredBulryang, summaryData, topDefectiveItems } = useMemo(() => {
    if (!data?.data.bulryang) return { filteredBulryang: [], summaryData: [], topDefectiveItems: [] };

    const filtered = data.data.bulryang.filter(row => {
      const rowDate = row['접수일']?.replace(/\./g, '-');
      return rowDate && rowDate >= startDate && rowDate <= endDate;
    });

    const total = filtered.length;

    // ── 유형별 요약: 각 카테고리에 속한 row를 모아 상품+옵션 집계
    const summaryData = DEFECT_CATEGORIES.map(cat => {
      const rows = filtered.filter(r => {
        const reason = r['불량 사유'] || '';
        return cat.keywords.some(k => reason.includes(k));
      });

      // 상품명+옵션 집계
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

    // 기타
    const othersCount = filtered.filter(r =>
      !ALL_DEFECT_KEYWORDS.some(k => (r['불량 사유'] || '').includes(k))
    ).length;

    // ── Top 3 상품별 불량 유형 순위
    const itemMap: Record<string, { count: number; reasons: Record<string, number> }> = {};
    filtered.forEach(r => {
      const name = r['상품명']?.trim();
      const reason = r['불량 사유']?.trim() || '미분류';
      if (!name) return;
      if (!itemMap[name]) itemMap[name] = { count: 0, reasons: {} };
      itemMap[name].count++;
      itemMap[name].reasons[reason] = (itemMap[name].reasons[reason] || 0) + 1;
    });

    const topItems = Object.entries(itemMap)
      .map(([name, { count, reasons }]) => {
        const topReasons = Object.entries(reasons)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([reason, cnt]) => ({ reason, count: cnt }));
        return { name, count, topReasons };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      filteredBulryang: filtered,
      summaryData,
      othersCount,
      topDefectiveItems: topItems,
    };
  }, [data, startDate, endDate]);

  if (loading && !data) return (
    <div className="flex h-[80vh] items-center justify-center text-rose-600 font-black animate-pulse">품질 정밀 분석 데이터 집계 중...</div>
  );

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
          <button onClick={loadData} className="p-2 hover:bg-slate-50 transition-colors border-l border-slate-100 ml-1">
            <Icon name="sync" className={loading ? 'animate-spin text-rose-600' : 'text-slate-400'} />
          </button>
        </div>
      </div>

      {/* ── 메인 그리드 ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── 왼쪽: 유형별 요약 (expandable) ─────────────────── */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-8 rounded-[32px] border-2 border-slate-100 shadow-xl relative overflow-hidden">
            <Icon name="analytics" className="absolute -right-10 -top-10 text-[200px] opacity-[0.03] rotate-12 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                <h4 className="text-lg font-black text-slate-900 uppercase">유형별 요약</h4>
                <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-3 py-1 rounded-full">{filteredBulryang.length}건</span>
              </div>

              <div className="space-y-6">
                {summaryData.map((cat) => (
                  <div key={cat.key}>
                    {/* 카테고리 행 */}
                    <button
                      className="w-full group text-left"
                      onClick={() => setExpandedCategory(expandedCategory === cat.key ? null : cat.key)}
                    >
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <p className="text-sm font-black text-slate-600 tracking-tight mb-1">{cat.name}</p>
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

                    {/* 드릴다운: 해당 유형의 상품+옵션 */}
                    {expandedCategory === cat.key && (
                      <div className={`mt-3 p-4 rounded-2xl ${cat.bgColor} border ${cat.borderColor} space-y-2`}>
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

                {/* 기타 (접기/펼침 없음) */}
                {filteredBulryang.length > 0 && (() => {
                  const others = filteredBulryang.length - summaryData.reduce((s, c) => s + c.count, 0);
                  if (others <= 0) return null;
                  return (
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <p className="text-sm font-black text-slate-400 tracking-tight mb-1">기타/단순변심</p>
                          <p className="text-3xl font-black text-slate-400">{others} <span className="text-xs opacity-30">건</span></p>
                        </div>
                        <span className="text-xs font-black text-slate-300">{Math.round((others / filteredBulryang.length) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-300 rounded-full" style={{ width: `${Math.round((others / filteredBulryang.length) * 100)}%` }}></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* ── 오른쪽: Top 3 상품 + 불량 유형 순위 ─────────────── */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <div>
                <h4 className="font-black text-2xl text-slate-900 tracking-tight">발생 상위 상품 (Top 3)</h4>
                <p className="text-xs text-slate-400 font-bold mt-1">각 상품별 불량 유형 순위를 함께 표시합니다.</p>
              </div>
              <div className="bg-rose-500 p-4 rounded-3xl shadow-lg shadow-rose-200">
                <Icon name="assignment_late" className="text-white text-3xl" />
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {topDefectiveItems.map((item, i) => (
                <div key={i} className="px-8 py-8 hover:bg-slate-50/40 transition-all group">
                  {/* 상단: 상품명 + 총 건수 */}
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-5 min-w-0">
                      <span className="text-5xl font-black text-slate-100 group-hover:text-rose-100 group-hover:scale-110 transition-all duration-500 italic shrink-0">0{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-base font-black text-slate-800 line-clamp-1 mb-1">{item.name}</p>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase">Management Required</span>
                          <span className="text-[10px] bg-rose-50 text-rose-500 px-2 py-0.5 rounded-md font-bold uppercase">High Frequency</span>
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

                  {/* 하단: 해당 상품의 불량 유형 순위 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {item.topReasons.map((r, j) => {
                      const cat = DEFECT_CATEGORIES.find(c => c.keywords.some(k => r.reason.includes(k)));
                      const bg = cat ? cat.bgColor : 'bg-slate-50';
                      const tc = cat ? cat.textColor : 'text-slate-400';
                      const bc = cat ? cat.color : '#94a3b8';
                      return (
                        <div key={j} className={`rounded-2xl p-3 ${bg} border border-transparent flex flex-col gap-1`}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black" style={{ color: bc }}>#{j + 1}</span>
                            <span className={`text-[10px] font-black truncate ${tc}`}>{r.reason}</span>
                          </div>
                          <p className={`text-xl font-black ${tc}`}>{r.count}<span className="text-[10px] opacity-50 ml-0.5">건</span></p>
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
                <p className="text-center py-20 text-slate-300 font-bold italic text-lg">조회 기간 내 데이터가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
