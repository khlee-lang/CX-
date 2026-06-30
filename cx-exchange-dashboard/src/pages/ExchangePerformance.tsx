import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '../components/ui/Icon';
import { fetchDashboardData } from '../api/sheets';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts';

// 이력 파싱 유틸리티
const parseHistoryTimestamp = (ts: string): Date => {
  // 예: "04. 07. 오후 05:54"
  try {
    const year = new Date().getFullYear();
    const parts = ts.split('. ');
    if (parts.length >= 2) {
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      return new Date(year, month - 1, day);
    }
  } catch (e) {}
  return new Date();
};

const isNormalShip = (shipVal: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(shipVal) || /^\d{4}\.\d{2}\.\d{2}$/.test(shipVal);
};

// 기간 포맷 유틸리티
const getDayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const getMonthStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const getWeekStr = (d: Date) => {
  const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dCopy.setUTCDate(dCopy.getUTCDate() + 4 - (dCopy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dCopy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${dCopy.getUTCFullYear()} W${weekNo}`;
};

type Period = 'daily' | 'weekly' | 'monthly';

export const ExchangePerformance: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('daily');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchDashboardData();
      if (res && res.data && res.data.jasaMall) {
        setData(res.data.jasaMall);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const processedMetrics = useMemo(() => {
    if (!data.length) return null;

    // 1. 발송 이력 맵핑
    const historyMap = new Map<string, string[]>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('alimtalk_history_')) {
        const orderNum = key.replace('alimtalk_history_', '');
        const history = JSON.parse(localStorage.getItem(key) || '[]');
        if (history.length > 0) historyMap.set(orderNum, history);
      }
    }

    let globalResolvedCount = 0;
    let globalTotalSent = 0;
    let globalTotalLeadTimeDays = 0;
    let globalValidLeadTimeCount = 0;

    const timeSeriesMap = new Map<string, { sent: number, resolved: number }>();
    const reasonGroups: Record<string, { sent: number, resolved: number }> = {
      '옵션 누락': { sent: 0, resolved: 0 },
      '미입금': { sent: 0, resolved: 0 },
      '장기 미회수': { sent: 0, resolved: 0 },
    };

    data.forEach(row => {
      const orderNumber = row['주문번호'];
      if (!historyMap.has(orderNumber)) return;

      const history = historyMap.get(orderNumber)!;
      const sentDate = parseHistoryTimestamp(history[0]);
      
      let periodKey = '';
      if (period === 'daily') periodKey = getDayStr(sentDate);
      else if (period === 'weekly') periodKey = getWeekStr(sentDate);
      else if (period === 'monthly') periodKey = getMonthStr(sentDate);

      if (!timeSeriesMap.has(periodKey)) {
        timeSeriesMap.set(periodKey, { sent: 0, resolved: 0 });
      }
      
      const tsData = timeSeriesMap.get(periodKey)!;

      globalTotalSent++;
      tsData.sent++;

      const shipVal = (row['출고일'] || '').trim();
      const option = (row['교환 출고 옵션'] || '').trim();
      const pay = (row['지불방법'] || '').trim();
      const exchangeType = (row['교환형태'] || '').trim();

      const hasMissingOption = !option || option === '확인중';
      const hasUnpaid = pay === '입금요청' || pay === '미입금';
      const isShipped = isNormalShip(shipVal) || shipVal === '철회' || shipVal === '교환불가' || exchangeType === '철회';
      const isWithdrawn = shipVal === '철회' || exchangeType === '철회' || shipVal === '교환불가';

      // 해당 주문의 모든 사유 리스트 생성
      const activeReasons: string[] = [];
      if (hasMissingOption) activeReasons.push('옵션 누락');
      if (hasUnpaid) activeReasons.push('미입금');
      
      // 옵션/입금 문제가 없는데 지연된 경우 '장기 미회수'로 분류
      if (activeReasons.length === 0) {
        activeReasons.push('장기 미회수');
      }

      // 사유별 해결 여부 판별 (사용자 정의 기준 반영)
      const isResolvedReason = (reason: string): boolean => {
        if (isWithdrawn) return true; // 철회는 공통 해결
        if (reason === '옵션 누락') return !hasMissingOption;
        if (reason === '미입금') return (pay !== '입금요청' && pay !== '미입금' && pay !== '');
        if (reason === '장기 미회수') return isShipped;
        return false;
      };

      // 각 사유별 발송 통계 합산
      activeReasons.forEach(r => {
        if (reasonGroups[r]) reasonGroups[r].sent++;
      });

      // 전체 주문 단위의 해결 여부: 최소 하나의 사유가 해결되었거나 최종 출고된 경우
      const isAnyReasonResolved = activeReasons.some(r => isResolvedReason(r));

      if (isShipped || isAnyReasonResolved) {
        globalResolvedCount++;
        tsData.resolved++;
        
        // 각 사유별 해결 통계 개별 합산
        activeReasons.forEach(r => {
          if (isResolvedReason(r)) {
            if (reasonGroups[r]) reasonGroups[r].resolved++;
          }
        });

        if (isNormalShip(shipVal)) {
          const shipDateStr = shipVal.replace(/\./g, '-');
          const shipDate = new Date(shipDateStr);
          if (!isNaN(shipDate.getTime()) && !isNaN(sentDate.getTime())) {
            const diffTime = Math.abs(shipDate.getTime() - sentDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            globalTotalLeadTimeDays += diffDays;
            globalValidLeadTimeCount++;
          }
        }
      }
    });

    const resolutionRate = globalTotalSent > 0 ? (globalResolvedCount / globalTotalSent) * 100 : 0;
    const savedTimeHours = (globalResolvedCount * 5) / 60; 
    const avgLeadTimeDays = globalValidLeadTimeCount > 0 ? (globalTotalLeadTimeDays / globalValidLeadTimeCount) : 0;
    const laborCostPerHr = 15000; // 예상 시급 기반 수치
    const costSaved = Math.round(savedTimeHours * laborCostPerHr);

    // 차트용 정렬된 데이터
    const chartData = Array.from(timeSeriesMap.entries())
      .map(([key, val]) => ({
        name: key,
        발송건수: val.sent,
        해결건수: val.resolved,
        전환율: val.sent > 0 ? Math.round((val.resolved / val.sent) * 100) : 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // 사유별 데이터
    const reasonData = Object.entries(reasonGroups).map(([reason, stats]) => ({
      reason,
      sent: stats.sent,
      resolved: stats.resolved,
      rate: stats.sent > 0 ? Math.round((stats.resolved / stats.sent) * 100) : 0
    })).sort((a, b) => b.rate - a.rate);

    return {
      globalTotalSent, globalResolvedCount, resolutionRate: Math.round(resolutionRate * 10) / 10,
      savedTimeHours: Math.round(savedTimeHours * 10) / 10,
      avgLeadTimeDays: Math.round(avgLeadTimeDays * 10) / 10,
      costSaved,
      chartData,
      reasonData
    };
  }, [data, period]);

  return (
    <div className="p-8 max-w-[1400px] mx-auto min-h-screen pb-24 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 mb-2">
            <span className="bg-indigo-100 text-indigo-600 p-2 rounded-xl">
              <Icon name="monitor_heart" />
            </span>
            교환 미처리 자동화 성과 지표
          </h1>
          <p className="text-slate-500 text-sm">자동화 안내톡 발송으로 인한 업무 리드타임 감축 및 인건비 절감 성과를 데이터로 증명합니다.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex">
            {['daily', 'weekly', 'monthly'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p as Period)}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  period === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === 'daily' ? '일간' : p === 'weekly' ? '주간' : '월간'} 리포트
              </button>
            ))}
          </div>
          <button onClick={loadData} className="ml-2 w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all shadow-sm">
            <Icon name={loading ? 'sync' : 'refresh'} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <Icon name="sync" className="animate-spin text-4xl text-indigo-500 mb-4" />
          <p className="text-slate-500 font-bold">성과 데이터를 계산하고 있습니다...</p>
        </div>
      ) : !processedMetrics || processedMetrics.globalTotalSent === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <Icon name="inbox" className="text-4xl text-slate-300 mb-4" />
          <p className="text-slate-500 font-bold">집계할 성과 데이터가 부족합니다.</p>
        </div>
      ) : (
        <>
          {/* 주요 KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 px-3 py-1 bg-slate-100 w-max rounded-lg mb-4">Conversion</span>
              <p className="text-sm font-bold text-slate-600 mb-2">알림톡 성공 전환율</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-indigo-600">{processedMetrics.resolutionRate}</span>
                <span className="text-lg font-bold text-indigo-400 mb-1">%</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">총 {processedMetrics.globalTotalSent}건 중 {processedMetrics.globalResolvedCount}건 해결</p>
            </div>
            
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 px-3 py-1 bg-slate-100 w-max rounded-lg mb-4">Lead Time</span>
              <p className="text-sm font-bold text-slate-600 mb-2">기록된 평균 해결 속도</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-emerald-600">{processedMetrics.avgLeadTimeDays}</span>
                <span className="text-lg font-bold text-emerald-400 mb-1">일 소요</span>
              </div>
              <p className="text-xs text-emerald-600/70 mt-2 font-medium">안내 후 고객 응답/출고까지의 평균</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 px-3 py-1 bg-slate-100 w-max rounded-lg mb-4">Time Saved</span>
              <p className="text-sm font-bold text-slate-600 mb-2">누적 운영 점유시간 절감</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-blue-600">{processedMetrics.savedTimeHours}</span>
                <span className="text-lg font-bold text-blue-400 mb-1">시간</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">건당 5분의 수기 안내/확인 시간 단축</p>
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 shadow-md shadow-indigo-900/20 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <Icon name="payments" className="text-9xl text-white" />
              </div>
              <span className="text-xs font-bold text-amber-900 px-3 py-1 bg-amber-400 w-max rounded-lg mb-4">Cost Value</span>
              <p className="text-sm font-bold text-slate-300 mb-2">자동화 창출 인건비 가치</p>
              <div className="flex items-end gap-2 relative z-10">
                <span className="text-4xl font-black text-white">₩{processedMetrics.costSaved.toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium relative z-10">절감 시간 × 자체 산정 시급 반영</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 차트 영역 */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800">
                  {period === 'daily' ? '일간' : period === 'weekly' ? '주간' : '월간'} 성과 및 전환율 트렌드
                </h3>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={processedMetrics.chartData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#F1F5F9' }}
                    />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }} />
                    <Bar yAxisId="left" dataKey="발송건수" fill="#E2E8F0" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar yAxisId="left" dataKey="해결건수" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line yAxisId="right" type="monotone" dataKey="전환율" stroke="#10B981" strokeWidth={3} dot={{ strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 사유별 브레이크다운 영역 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold text-slate-800 mb-6">사유별 알림톡 성과 효율</h3>
              <div className="flex-1 space-y-6">
                {processedMetrics.reasonData.map((item, idx) => (
                  <div key={idx} className="relative group">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        <span className="text-sm font-bold text-slate-700">{item.reason}</span>
                      </div>
                      <span className="text-lg font-black text-indigo-600">{item.rate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${item.rate >= 50 ? 'bg-indigo-500' : 'bg-amber-400'}`}
                        style={{ width: `${item.rate}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1 text-[11px] text-slate-400 font-medium px-1">
                      <span>총 발송: {item.sent}건</span>
                      <span>해결완료: {item.resolved}건</span>
                    </div>
                  </div>
                ))}
                
                <div className="mt-auto pt-6 border-t border-slate-100">
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <div className="flex items-start gap-2">
                      <Icon name="lightbulb" className="text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-900 mb-1">인사이트 & 다음 스텝</p>
                        <p className="text-xs text-amber-800/80 leading-relaxed">
                          현재 <span className="font-bold underline">{processedMetrics.reasonData[0]?.reason}</span> 사유에 대한 응답 전환율이 가장 높습니다. 미처리 리스트에서 해당 사유 건부터 먼저 일괄 발송하는 것을 권장합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
