import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '../components/ui/Icon';
import { fetchDashboardData, type ExchangeData } from '../api/sheets';

export const LowStockAlerts: React.FC = () => {
  const [data, setData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const result = await fetchDashboardData();
        setData(result);
      } catch (err: any) {
        console.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const processedData = useMemo(() => {
    if (!data?.data?.inventory) return { stockList: [], topRisk: [], totalItems: 0, highRiskCount: 0 };
    
    // Parse inventory items
    const parsed = data.data.inventory
      .filter((row: any) => row.ITEM && row.INVENTORY && row.INVENTORY !== '판토스\\n가용재고')
      .map((row: any) => {
        const stockStr = String(row.INVENTORY || '0').replace(/,/g, '');
        const stockNum = parseInt(stockStr, 10);
        return {
          row,
          name: row.ITEM,
          option: `${row.COLOR || ''} / ${row.SIZE || ''}`.trim().replace(/^\/|\/$/g, '').trim(),
          stock: isNaN(stockNum) ? 0 : stockNum,
          sku: row.SKU || '',
        };
      });

    const totalItems = parsed.length;
    // Assume < 100 is high risk for demo purposes
    const highRiskItems = parsed.filter(p => p.stock < 100);
    const highRiskCount = highRiskItems.length;

    let filtered = parsed;
    if (searchTerm) {
      filtered = parsed.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.option.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Sort by stock ascending (lowest stock first)
    filtered.sort((a, b) => a.stock - b.stock);

    const stockList = filtered.map(item => ({
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJ9COz7NSM-BQe-zS8YnGD3WqijVX-ViSptU4Wt1AjGxrECJvy_p62Dr21l_wxvqOSbPFJPz6TkPsz7m5BTJYxYdN5J2Q2tNUa8T5M1MG_RkpGBomKdZxmaJ9WM1ShFZXqnR_-rI5jwk2WBY55ysfzlNd-0i4ZYXnr40xVEnh6G5LP49IiRBvTDbBLKOVObMNYvSe-26zqUfMmfMBTX-U8UaO1P0E-vwPNWN17h9Wjjt-13Tz3z-nOrxd1bP0USIVqnFqxuJCtFqM',
      name: item.name,
      option: item.option,
      stock: `${item.stock.toLocaleString()}ea`,
      stockColor: item.stock < 100 ? 'text-error' : (item.stock < 500 ? 'text-orange-500' : 'text-on-surface'),
      tagText: item.stock < 100 ? 'LOW' : (item.stock < 500 ? 'CAUTION' : 'SAFE'),
      tagColor: item.stock < 100 
        ? 'bg-error-container text-on-error-container' 
        : (item.stock < 500 ? 'bg-secondary-container text-on-secondary-container' : 'bg-emerald-100 text-emerald-800'),
      freq: '연동 대기중',
      pred: item.stock < 100 ? '위험' : (item.stock < 500 ? '주의' : '안정적'),
      predColor: item.stock < 100 ? 'text-error' : (item.stock < 500 ? 'text-orange-500' : 'text-slate-500'),
      trend: 'N/A',
      trendColor: 'text-slate-400',
      alts: [],
      actionText: item.stock < 100 ? '발주 확인' : '상세 보기',
      actionStyle: item.stock < 100 ? 'bg-error text-white hover:shadow-error/30' : 'border border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600',
      original: item.row
    }));

    // Top 3 Risk for the chart
    const topRisk = filtered.slice(0, 3).map((item) => {
      // visualization percentage wrapper
      const percentageNum = Math.min(Math.max((item.stock / 500) * 100, 5), 100);
      return {
        name: `${item.name} (${item.option.substring(0, 10)}${item.option.length > 10 ? '...' : ''})`,
        daysLeft: item.stock < 100 ? '긴급' : '주의',
        stock: item.stock,
        demand: 'N/A',
        width1: `${Math.round(percentageNum)}%`,
        width2: `${100 - Math.round(percentageNum)}%`
      };
    });

    return { stockList, topRisk, totalItems, highRiskCount, parsed };
  }, [data, searchTerm]);

  if (loading && !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-indigo-600 font-bold animate-pulse">
        재고 현황 불러오는 중...
      </div>
    );
  }

  const { stockList, topRisk, totalItems, highRiskCount, parsed } = processedData;

  const avgStock = totalItems > 0 && parsed ? Math.round(parsed.reduce((acc: number, cur: any) => acc + cur.stock, 0) / totalItems) : 0;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full relative pb-12">
      {/* Alert Banner: High Risk */}
      {highRiskCount > 0 && (
        <div className="bg-error-container/40 border-l-4 border-error p-5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-error text-on-error w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-error/20">
              <Icon name="warning" />
            </div>
            <div>
              <h4 className="text-on-error-container font-bold text-base">긴급 재고 부족 상품 ({highRiskCount.toLocaleString()}건)</h4>
              <p className="text-on-error-container/80 text-sm">재고 임계값 100개 미만인 품목입니다. 즉시 출고 및 발주 확인이 필요합니다.</p>
            </div>
          </div>
          <button className="bg-error text-on-error px-4 py-2 rounded-lg text-sm font-bold hover:scale-105 transition-transform active:scale-95">발주 리스트 확인</button>
        </div>
      )}

      {/* Bento KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-slate-100/50 shadow-sm">
          <p className="text-xs font-bold text-slate-500 font-label mb-1">전체 관리 품목 수</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold font-headline text-slate-900 tracking-tight">{totalItems.toLocaleString()}</span>
            <span className="text-sm font-semibold text-slate-400 mb-1 flex items-center">
              Items
            </span>
          </div>
          <div className="mt-4 w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary w-full h-full"></div>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-slate-100/50 shadow-sm">
          <p className="text-xs font-bold text-slate-500 font-label mb-1">고위험 품목 (100개 미만)</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold font-headline text-error tracking-tight">{highRiskCount.toLocaleString()}</span>
            <span className="text-sm font-semibold text-slate-400 mb-1">Items</span>
          </div>
          <div className="mt-4 flex gap-1">
             {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`h-2 w-full rounded-sm ${i < Math.ceil((highRiskCount/totalItems)*4 || 0.1) ? 'bg-error' : 'bg-error/20'}`}></div>
             ))}
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-slate-100/50 shadow-sm">
          <p className="text-xs font-bold text-slate-500 font-label mb-1">교환 제한 예상</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold font-headline text-slate-900 tracking-tight">{highRiskCount.toLocaleString()}</span>
            <span className="text-sm font-semibold text-indigo-600 mb-1 flex items-center">Active</span>
          </div>
          <p className="mt-4 text-[11px] text-slate-400 leading-tight">품절 임박으로 자동 제한이 권장되는 상품의 합계입니다.</p>
        </div>
        <div className="bg-indigo-600 p-6 rounded-xl shadow-lg shadow-indigo-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold text-indigo-100 font-label">재고 임계값 설정</p>
            <Icon name="tune" className="text-indigo-200" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-headline">Under 100개</div>
            <p className="text-xs text-indigo-100/70 mt-1">현재 안전 재고 기준치</p>
          </div>
        </div>
      </div>

      {/* Visualization Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart: Top 10 Risk Items */}
        <div className="lg:col-span-2 bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-slate-100/50">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-slate-900">최저 재고 위험 품목 (Top 3)</h3>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-slate-500 font-medium"><span className="w-2 h-2 rounded-full bg-primary"></span> 잔여 재고 잔량</span>
              <span className="flex items-center gap-1 text-xs text-slate-500 font-medium"><span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim"></span> 여유 공간</span>
            </div>
          </div>
          <div className="space-y-4">
            {topRisk.map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">{item.name}</span>
                  <span className={i === 0 ? 'text-error' : 'text-slate-500'}>{item.daysLeft} 수준 (최저)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-8 bg-surface-container rounded-md flex overflow-hidden">
                    <div className="bg-primary/90 h-full flex items-center px-2 text-[10px] text-white font-bold" style={{ width: item.width1 }}>{item.stock.toLocaleString()}개</div>
                    <div className="bg-tertiary-fixed-dim/30 h-full border-l-2 border-white flex items-center px-2 text-[10px] text-slate-600 italic" style={{ width: item.width2 }}></div>
                  </div>
                </div>
              </div>
            ))}
            {topRisk.length === 0 && <p className="text-slate-400 text-sm italic">재고가 분석된 항목이 없습니다.</p>}
          </div>
        </div>

        {/* Demand Change Summary */}
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-slate-100/50 flex flex-col">
          <h3 className="text-base font-bold text-slate-900 mb-6">AI 재고 진단 커멘트</h3>
          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">품목별 평균 가용재고</p>
                  <h5 className="text-2xl font-bold font-headline">
                    {avgStock.toLocaleString()}개
                  </h5>
                </div>
                <div className="text-indigo-600 bg-indigo-50 p-2 rounded-lg">
                  <Icon name="inventory" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">재고 불균형 위험도</p>
                  <h5 className="text-2xl font-bold font-headline text-error">주의 단계</h5>
                </div>
                <div className="text-error bg-error-container/50 p-2 rounded-lg">
                  <Icon name="warning" />
                </div>
              </div>
            </div>
            <div className="mt-8 p-4 bg-surface-container-low rounded-lg">
              <p className="text-xs text-slate-600 leading-relaxed font-medium italic">
                현재 등록된 <strong>{totalItems.toLocaleString()}</strong>개의 품목 중 <strong>{highRiskCount.toLocaleString()}</strong>개가 재고 하위 임계값을 밑돌고 있습니다. 주요 인기 사이즈에 대한 빠른 발주가 필요합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Risk Table Section */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-slate-100/50 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h3 className="text-base font-bold text-on-surface">재고 우선순위 모니터링</h3>
          <div className="flex gap-2">
            <div className="relative">
              <input 
                 className="pl-9 pr-4 py-2 bg-surface-container-low border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary w-64" 
                 placeholder="상품명/옵션 검색..." 
                 type="text" 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Icon name="search" className="absolute left-3 top-2.5 text-slate-400 text-sm" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left relative">
            <thead className="bg-surface-container-low/80 sticky top-0 backdrop-blur z-20 shadow-sm">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-slate-600 font-label tracking-tighter">상품 정보 / 옵션</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-600 font-label tracking-tighter">현재 재고(판토스)</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-600 font-label tracking-tighter">교환 빈도</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-600 font-label tracking-tighter">분석 상태</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-600 font-label tracking-tighter text-center">관리 액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockList.slice(0, 50).map((row, i) => (
                <tr key={i} className={`hover:bg-indigo-50/50 transition-colors group ${row.stockColor === 'text-error' ? 'bg-rose-50/30' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200/50">
                        <img src={row.image} alt={row.name} className="w-full h-full object-cover opacity-70 mix-blend-multiply" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 leading-none mb-1.5">{row.name}</p>
                        <p className="text-[11px] font-semibold text-slate-500 bg-slate-100 inline-block px-1.5 py-0.5 rounded text-left">
                          Opt: <span className="text-slate-700">{row.option}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${row.stockColor}`}>{row.stock}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-black tracking-wide rounded ${row.tagColor}`}>{row.tagText}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[11px] text-slate-400 italic font-medium">{row.freq}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${row.predColor.replace('text-', 'bg-')}`}></div>
                      <span className={`text-xs font-bold ${row.predColor}`}>{row.pred} 지표</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${row.actionStyle}`}>
                      {row.actionText}
                    </button>
                  </td>
                </tr>
              ))}
              {stockList.length === 0 && (
                 <tr>
                    <td colSpan={5} className="text-center py-16 text-slate-400 font-bold">표시할 데이터가 없습니다.</td>
                 </tr>
              )}
            </tbody>
          </table>
          {stockList.length > 50 && (
             <div className="text-center py-4 text-xs text-slate-400 font-bold bg-slate-50 border-t border-slate-100">
               나머지 데이터는 스크롤하여 확인할 수 있습니다 (상위 50개 우선 표시됨)
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
