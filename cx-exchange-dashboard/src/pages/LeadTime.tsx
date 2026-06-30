import React, { useState } from 'react';
import { Icon } from '../components/ui/Icon';

const CHANNEL_LEADTIMES = [
  { name: '자사몰 (D2C)', time: '3.4일', fill: '45%' },
  { name: '네이버 스마트스토어', time: '4.1일', fill: '55%' },
  { name: '쿠팡 (윙/제트)', time: '4.8일', fill: '65%' },
  { name: '기타 오픈마켓', time: '5.2일', fill: '70%' },
];

const ISSUE_LOGS = [
  { 
    title: '센터 피크 시즌 대응 지연', date: '2024.05.21', 
    desc: '프로모션 물량 폭증으로 인한 입고 스캔 24시간 지연', 
    status: '지연', statusColor: 'bg-error-container text-on-error-container', 
    manager: '김철수', borderColor: 'border-error' 
  },
  { 
    title: '배송 추적 API 업데이트', date: '2024.05.15', 
    desc: 'CJ대한통운 API 연동 최적화로 추적 리드타임 0.2일 단축', 
    status: '개선', statusColor: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', 
    manager: '이영희', borderColor: 'border-tertiary-container' 
  },
];

export const LeadTime: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full relative">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-on-surface font-headline">회수/출고 리드타임 분석</h2>
          <p className="text-on-surface-variant mt-1">교환 요청 접수부터 최종 출고까지의 단계별 소요 시간 및 운영 병목 분석</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white text-on-surface-variant border border-outline-variant/30 rounded-lg text-sm font-medium hover:bg-surface-container transition-colors flex items-center gap-2">
            <Icon name="calendar_today" className="text-sm" /> 최근 30일
          </button>
          <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2">
            <Icon name="download" className="text-sm" /> 리포트 내보내기
          </button>
        </div>
      </div>

      {/* KPI Cards - Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-transparent hover:border-primary/10 transition-all">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">평균 리드타임</p>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-headline">4.2</span>
            <span className="text-sm font-medium text-on-surface-variant">일</span>
          </div>
          <p className="mt-2 text-xs text-error flex items-center gap-1 font-medium">
            <Icon name="trending_up" className="text-xs" /> +0.4일 (전월비)
          </p>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-transparent">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">중앙값 (Median)</p>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-headline">3.8</span>
            <span className="text-sm font-medium text-on-surface-variant">일</span>
          </div>
          <p className="mt-2 text-xs text-tertiary-container flex items-center gap-1 font-medium">
            <Icon name="remove" className="text-xs" /> 변동 없음
          </p>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-transparent">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">최대 소요 시간</p>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-headline">12.5</span>
            <span className="text-sm font-medium text-on-surface-variant">일</span>
          </div>
          <p className="mt-2 text-xs text-error flex items-center gap-1 font-medium">
            <Icon name="warning" className="text-xs" /> 특이 케이스 3건
          </p>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-transparent">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">선출고 비중</p>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-headline">24.8</span>
            <span className="text-sm font-medium text-on-surface-variant">%</span>
          </div>
          <p className="mt-2 text-xs text-tertiary-container flex items-center gap-1 font-medium">
            <Icon name="trending_up" className="text-xs" /> +2.1% (전주비)
          </p>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-transparent">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">입고 완료율</p>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-headline">88.4</span>
            <span className="text-sm font-medium text-on-surface-variant">%</span>
          </div>
          <div className="mt-2 w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
            <div className="bg-tertiary-fixed-dim h-full" style={{ width: '88%' }}></div>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-transparent">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">장기 미회수</p>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-headline text-error">42</span>
            <span className="text-sm font-medium text-on-surface-variant">건</span>
          </div>
          <p className="mt-2 text-[10px] text-on-surface-variant leading-tight">14일 이상 미입고 건</p>
        </div>
      </div>

      {/* Visual Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Trend Chart */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl p-6 relative overflow-hidden">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-lg font-bold font-headline">리드타임 추이 및 운영 이슈</h3>
              <p className="text-xs text-on-surface-variant mt-1">일별 평균 리드타임 변동 및 기록된 주요 이슈 마커</p>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="px-3 py-1.5 bg-secondary-container text-on-secondary-container rounded-lg text-xs font-bold hover:bg-secondary-fixed transition-colors flex items-center gap-1"
            >
              <Icon name="edit_note" className="text-sm" /> Issue Record
            </button>
          </div>
          {/* Mock Chart Area */}
          <div className="h-64 w-full relative">
            <div className="absolute inset-0 flex flex-col justify-between">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full border-t border-outline-variant/10"></div>
              ))}
            </div>
            <svg className="absolute inset-0 w-full h-full preserve-3d" viewBox="0 0 800 200" preserveAspectRatio="none">
              <path d="M0,150 Q50,140 100,160 T200,120 T300,130 T400,90 T500,110 T600,70 T700,80 T800,60" fill="none" stroke="#3525cd" strokeLinecap="round" strokeWidth="3"></path>
              <path d="M0,150 Q50,140 100,160 T200,120 T300,130 T400,90 T500,110 T600,70 T700,80 T800,60 L800,200 L0,200 Z" fill="url(#gradient-chart)" fillOpacity="0.1"></path>
              <defs>
                <linearGradient id="gradient-chart" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3525cd"></stop>
                  <stop offset="100%" stopColor="transparent"></stop>
                </linearGradient>
              </defs>
              <g className="cursor-pointer">
                <circle cx="400" cy="90" fill="#ba1a1a" r="6"></circle>
                <circle cx="400" cy="90" fill="#ba1a1a" fillOpacity="0.2" r="10">
                  <animate attributeName="r" dur="2s" repeatCount="indefinite" values="8;14;8"></animate>
                </circle>
                <text fill="#ba1a1a" fontSize="10" fontWeight="bold" x="410" y="85">물류센터 피크</text>
              </g>
              <g className="cursor-pointer">
                <circle cx="600" cy="70" fill="#005338" r="6"></circle>
                <text fill="#005338" fontSize="10" fontWeight="bold" x="610" y="65">자동화 프로세스 적용</text>
              </g>
            </svg>
            <div className="absolute bottom-[-24px] w-full flex justify-between text-[10px] text-on-surface-variant font-medium px-2">
              <span>05/01</span><span>05/07</span><span>05/14</span><span>05/21</span><span>05/28</span><span>06/04</span>
            </div>
          </div>
        </div>

        {/* Recovery Status Donut */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 flex flex-col items-center justify-center">
          <h3 className="text-sm font-bold w-full text-left mb-6">회수 완료 현황</h3>
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" fill="none" r="16" stroke="#eceef0" strokeWidth="4"></circle>
              <circle cx="18" cy="18" fill="none" r="16" stroke="#4edea3" strokeDasharray="88, 100" strokeLinecap="round" strokeWidth="4"></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold font-headline">88.4%</span>
              <span className="text-[10px] text-on-surface-variant font-medium">회수 완료</span>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 w-full">
            <div className="text-center">
              <p className="text-[10px] text-on-surface-variant font-semibold">정상 회수</p>
              <p className="text-sm font-bold text-tertiary">1,240건</p>
            </div>
            <div className="text-center border-l border-outline-variant/20">
              <p className="text-[10px] text-on-surface-variant font-semibold">지연/누락</p>
              <p className="text-sm font-bold text-error">162건</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lead Time Funnel & Detailed Table */}
      <div className="grid grid-cols-1 gap-8">
        {/* Pipeline Funnel */}
        <div className="bg-surface-container p-8 rounded-2xl">
          <h3 className="text-lg font-bold mb-8 text-center">교환 프로세스 리드타임 깔때기 (Average)</h3>
          <div className="flex items-center justify-between gap-4 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="flex-1 flex flex-col items-center group">
              <div className="w-full h-20 bg-primary-container/20 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
                <span className="text-[11px] font-bold text-primary mb-1">교환 접수</span>
                <span className="text-lg font-bold text-primary font-headline">0.0D</span>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-primary"></div>
              </div>
              <p className="mt-4 text-[11px] text-on-surface-variant font-semibold">Receipt</p>
            </div>
            <div className="flex items-center text-outline-variant/40"><Icon name="chevron_right" /></div>
            {/* Step 2 */}
            <div className="flex-1 flex flex-col items-center group">
              <div className="w-full h-20 bg-primary-container/40 rounded-xl flex flex-col items-center justify-center relative">
                <span className="text-[11px] font-bold text-primary mb-1">회수 추적</span>
                <span className="text-lg font-bold text-primary font-headline">+1.2D</span>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-primary"></div>
              </div>
              <p className="mt-4 text-[11px] text-on-surface-variant font-semibold">Tracking Identified</p>
            </div>
            <div className="flex items-center text-outline-variant/40"><Icon name="chevron_right" /></div>
            {/* Step 3 */}
            <div className="flex-1 flex flex-col items-center group">
              <div className="w-full h-20 bg-primary-container/60 rounded-xl flex flex-col items-center justify-center relative">
                <span className="text-[11px] font-bold text-white mb-1">센터 입고</span>
                <span className="text-lg font-bold text-white font-headline">+2.1D</span>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-white/50"></div>
              </div>
              <p className="mt-4 text-[11px] text-on-surface-variant font-semibold">Warehouse Inbound</p>
            </div>
            <div className="flex items-center text-outline-variant/40"><Icon name="chevron_right" /></div>
            {/* Step 4 */}
            <div className="flex-1 flex flex-col items-center group">
              <div className="w-full h-20 bg-primary rounded-xl flex flex-col items-center justify-center relative shadow-lg shadow-primary/20">
                <span className="text-[11px] font-bold text-white mb-1">교환 출고</span>
                <span className="text-lg font-bold text-white font-headline">+0.9D</span>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20"></div>
              </div>
              <p className="mt-4 text-[11px] text-on-surface-variant font-semibold">Exchange Shipped</p>
            </div>
          </div>
        </div>

        {/* Channel Comparison & Detailed Issue Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10">
            <h3 className="text-sm font-bold mb-4">채널별 리드타임 비교</h3>
            <div className="space-y-5">
              {CHANNEL_LEADTIMES.map(ch => (
                <div key={ch.name} className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{ch.name}</span>
                    <span className="text-primary">{ch.time}</span>
                  </div>
                  <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full" style={{ width: ch.fill }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold">운영 이슈 로그 (최근)</h3>
              <button className="text-xs text-primary font-bold hover:underline">전체보기</button>
            </div>
            <div className="space-y-3">
              {ISSUE_LOGS.map((log, i) => (
                <div key={i} className={`p-3 bg-surface-container-low rounded-xl border-l-4 ${log.borderColor}`}>
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold">{log.title}</p>
                    <span className="text-[10px] text-on-surface-variant">{log.date}</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-1">{log.desc}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${log.statusColor}`}>{log.status}</span>
                    <span className="text-[10px] text-on-surface-variant">담당자: {log.manager}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Sidebar: Operational Issue Logging */}
      <div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-[60] transform ${isSidebarOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-full opacity-0 pointer-events-none'} transition-all duration-300 border-l border-slate-200`}>
        <div className="p-8 h-full flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold font-headline">운영 이슈 기록</h3>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Icon name="close" /></button>
          </div>
          <form className="space-y-6 flex-1 overflow-y-auto pr-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant">기간</label>
              <input readOnly className="w-full bg-surface-container-low border-none rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-primary/20" type="text" value="2024-05-21 ~ 2024-05-23" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant">이슈 유형</label>
              <select className="w-full bg-surface-container-low border-none rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-primary/20">
                <option>물류센터 과부하</option>
                <option>택배사 파업/지연</option>
                <option>시스템 오류</option>
                <option>기상 악화</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant">발생 원인</label>
              <textarea className="w-full bg-surface-container-low border-none rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-primary/20" placeholder="구체적인 원인을 입력하세요" rows={3}></textarea>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant">대응 조치</label>
              <textarea className="w-full bg-surface-container-low border-none rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-primary/20" placeholder="취해진 조치 사항을 입력하세요" rows={3}></textarea>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant">담당자</label>
                <input className="w-full bg-surface-container-low border-none rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-primary/20" placeholder="담당자 성함" type="text" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant">후속 조치 필요</label>
                <div className="flex items-center h-11">
                  <input className="rounded text-primary focus:ring-primary/20 border-slate-300" type="checkbox" />
                  <span className="ml-2 text-sm text-on-surface-variant">예</span>
                </div>
              </div>
            </div>
          </form>
          <div className="pt-6 border-t border-slate-100 flex gap-3">
            <button onClick={() => setIsSidebarOpen(false)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors">취소</button>
            <button onClick={() => setIsSidebarOpen(false)} className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity">이슈 저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};
