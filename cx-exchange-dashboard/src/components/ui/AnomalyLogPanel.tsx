import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { fetchAnomalyEvents, type AnomalyEvent } from '../../api/anomalyLog';

const GRANULARITY_LABEL: Record<string, string> = { day: '일간', week: '주간', month: '월간' };
const CHANNEL_LABEL: Record<string, string> = { jasa: '자사몰', oebu: '외부몰' };

/** 관제 그래프 드릴다운에서 수동으로 기록한 이상 이벤트 최근 목록 */
export const AnomalyLogPanel: React.FC = () => {
  const [events, setEvents] = useState<AnomalyEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAnomalyEvents(10)
      .then((data) => { if (!cancelled) setEvents(data); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
      <h4 className="text-base font-black text-slate-900 mb-1 border-b border-slate-50 pb-4">이상 이벤트 로그</h4>
      <p className="text-xs text-slate-400 font-bold mt-2 mb-4">관제 그래프에서 수동으로 기록한 밴드초과 이벤트 최근 10건</p>
      {error && <p className="text-sm text-rose-500 font-bold py-4">{error}</p>}
      {!error && events === null && <p className="text-sm text-slate-400 font-bold py-4">조회 중...</p>}
      {events && events.length === 0 && (
        <p className="text-sm text-slate-400 font-bold py-4">아직 기록된 이상 이벤트가 없습니다.</p>
      )}
      {events && events.length > 0 && (
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.event_id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                    {CHANNEL_LABEL[ev.channelGroup] || ev.channelGroup}
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                    {GRANULARITY_LABEL[ev.granularity] || ev.granularity}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {ev.bucket_start === ev.bucket_end ? ev.bucket_start : `${ev.bucket_start} ~ ${ev.bucket_end}`}
                  </span>
                </div>
                <span className="text-sm font-black text-rose-500 flex-shrink-0">{ev.rate?.toFixed(2)}%</span>
              </div>
              <p className="text-sm text-slate-700 font-medium mt-2 flex items-start gap-1.5">
                <Icon name="sticky_note_2" className="text-sm text-slate-300 mt-0.5 flex-shrink-0" />
                {ev.memo}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
