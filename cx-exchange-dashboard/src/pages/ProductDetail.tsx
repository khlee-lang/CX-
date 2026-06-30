import React from 'react';
import { Icon } from '../components/ui/Icon';

export const ProductDetail: React.FC = () => {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full relative pb-12">
      {/* Product Search Section */}
      <section className="p-8 bg-surface-container-low rounded-xl">
        <div className="max-w-4xl mx-auto text-center mb-8">
          <h2 className="text-3xl font-bold font-headline mb-2">상품별 심층 분석</h2>
          <p className="text-on-surface-variant">상품명을 입력하여 출고, 교환, 결함 및 물류 리드타임을 한눈에 파악하세요.</p>
        </div>
        <div className="max-w-3xl mx-auto relative group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Icon name="search" className="text-primary text-2xl" />
          </div>
          <input 
            className="w-full pl-16 pr-32 py-5 bg-surface-container-lowest rounded-2xl shadow-sm border-none focus:ring-2 focus:ring-primary/20 text-xl font-medium tracking-tight placeholder:text-slate-400" 
            placeholder="상품명 또는 SKU 번호를 입력하세요..." 
            type="text" 
            defaultValue="울트라 라이트 패딩 자켓 (2024 Ver.)" 
          />
          <div className="absolute inset-y-2 right-2 flex items-center">
            <button className="px-6 h-full bg-primary text-white font-bold rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity">
              분석하기
              <Icon name="arrow_forward" />
            </button>
          </div>
        </div>
      </section>

      {/* Analysis Dashboard */}
      <section className="space-y-8">
        {/* Hero Stats Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Main Product Card */}
          <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-xl flex gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Icon name="inventory" className="text-8xl" />
            </div>
            <div className="w-32 h-40 bg-slate-100 rounded-lg overflow-hidden shrink-0">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAjiLneHMHwW2GNLe5vNwGW0Faho4-fjqLQVkjaQCLuJnd7V1yDPtymwDHdag-xL5PijF7dBxbnnYevK5urUuMVN6W9RoV4iGWL2A4jqpTpPT3k-OWj-8vSArBGz8Xy_ShTlucqzZ6xZK2XT-YvveJTkvM53FQ7HxXWuDaCULmqdRx-_Oo7nBqmWy_X8HpLQfVv7KK5KXSKf8oG_VcbmV7VAAUN09aimsR37YUnA-CHrUEovFieHI3GCEPQIvzGhPf-QEXIlBtMf8A" alt="Product Image" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            </div>
            <div className="flex flex-col justify-between">
              <div>
                <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded mb-2">SEASON BEST</span>
                <h3 className="text-xl font-bold tracking-tight mb-1">울트라 라이트 패딩 자켓</h3>
                <p className="text-sm text-on-surface-variant">SKU: JK-2024-UL-092 | 카테고리: 아우터</p>
              </div>
              <div className="flex gap-4">
                <div className="px-4 py-2 bg-surface-container-low rounded-lg">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">총 출고량</p>
                  <p className="text-xl font-black">12,482 <span className="text-xs font-normal">건</span></p>
                </div>
                <div className="px-4 py-2 bg-surface-container-low rounded-lg">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">현재 재고</p>
                  <p className="text-xl font-black text-primary">842 <span className="text-xs font-normal">건</span></p>
                </div>
              </div>
            </div>
          </div>
          {/* Metrics */}
          <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                  <Icon name="swap_horiz" className="text-indigo-600" />
                </span>
                <span className="text-[10px] font-bold text-error">+2.4% MoM</span>
              </div>
              <p className="text-sm font-medium text-on-surface-variant">교환율 (Exchange Rate)</p>
              <h4 className="text-3xl font-bold font-headline">4.82%</h4>
            </div>
            <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-4 overflow-hidden">
              <div className="bg-primary h-full w-[48%]"></div>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                  <Icon name="report_problem" className="text-rose-600" />
                </span>
                <span className="text-[10px] font-bold text-tertiary-container">-1.2% MoM</span>
              </div>
              <p className="text-sm font-medium text-on-surface-variant">불량률 (Defective Rate)</p>
              <h4 className="text-3xl font-bold font-headline">0.95%</h4>
            </div>
            <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-4 overflow-hidden">
              <div className="bg-rose-500 h-full w-[10%]"></div>
            </div>
          </div>
        </div>

        {/* Detailed Analysis Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Data Visuals */}
          <div className="lg:col-span-2 space-y-8">
            {/* Option Flow & Defect Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option Flow */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border-l-4 border-indigo-500">
                <div className="flex items-center justify-between mb-6">
                  <h5 className="text-sm font-bold flex items-center gap-2">
                    <Icon name="route" className="text-indigo-600" />
                    교환 옵션 흐름 (From → To)
                  </h5>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-8 bg-surface-container-low rounded-md flex items-center px-3 text-xs font-medium">95 (M)</div>
                    <Icon name="arrow_right_alt" className="text-slate-300" />
                    <div className="flex-1 h-8 bg-indigo-50 text-indigo-700 rounded-md flex items-center px-3 text-xs font-bold">100 (L)</div>
                    <span className="text-xs font-bold">62%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-8 bg-surface-container-low rounded-md flex items-center px-3 text-xs font-medium">Black</div>
                    <Icon name="arrow_right_alt" className="text-slate-300" />
                    <div className="flex-1 h-8 bg-slate-900 text-white rounded-md flex items-center px-3 text-xs font-bold">Navy</div>
                    <span className="text-xs font-bold">18%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-8 bg-surface-container-low rounded-md flex items-center px-3 text-xs font-medium">105 (XL)</div>
                    <Icon name="arrow_right_alt" className="text-slate-300" />
                    <div className="flex-1 h-8 bg-indigo-50 text-indigo-700 rounded-md flex items-center px-3 text-xs font-bold">100 (L)</div>
                    <span className="text-xs font-bold">12%</span>
                  </div>
                </div>
                <p className="mt-6 text-[11px] text-on-surface-variant leading-relaxed">
                  <span className="font-bold text-indigo-600">인사이트:</span> 해당 상품은 '정사이즈보다 작게 나옴' 피드백이 많아 한 단계 큰 사이즈로의 교환이 지배적입니다.
                </p>
              </div>

              {/* Defect Distribution */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border-l-4 border-rose-500">
                <h5 className="text-sm font-bold flex items-center gap-2 mb-6">
                  <Icon name="broken_image" className="text-rose-600" />
                  주요 결함 유형 분포
                </h5>
                <div className="relative h-32 flex items-end gap-2">
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-rose-200 rounded-t-md transition-all hover:bg-rose-400" style={{ height: '70%' }}></div>
                    <span className="text-[10px] text-on-surface-variant text-center leading-tight">봉제<br/>불량</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-rose-200 rounded-t-md transition-all hover:bg-rose-400" style={{ height: '40%' }}></div>
                    <span className="text-[10px] text-on-surface-variant text-center leading-tight">충전재<br/>쏠림</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-rose-200 rounded-t-md transition-all hover:bg-rose-400" style={{ height: '25%' }}></div>
                    <span className="text-[10px] text-on-surface-variant text-center leading-tight">지퍼<br/>결함</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-rose-200 rounded-t-md transition-all hover:bg-rose-400" style={{ height: '15%' }}></div>
                    <span className="text-[10px] text-on-surface-variant text-center leading-tight">오염</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-[11px]">
                  <span className="text-on-surface-variant">총 결함 건수: 118건</span>
                  <span className="font-bold text-rose-600">관리 필요</span>
                </div>
              </div>
            </div>

            {/* Lead Time Trend Chart Area */}
            <div className="bg-surface-container-lowest p-8 rounded-xl">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h5 className="text-lg font-bold">물류 리드타임 추이 (최근 8주)</h5>
                  <p className="text-xs text-on-surface-variant">출고부터 도착까지의 평균 소요 시간</p>
                </div>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium"><span className="w-2 h-2 rounded-full bg-primary"></span> 평균</span>
                  <span className="flex items-center gap-1.5 text-xs font-medium"><span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim"></span> 목표</span>
                </div>
              </div>
              <div className="h-64 flex items-end justify-between px-4 relative">
                {/* Horizontal Grid Lines */}
                <div className="absolute inset-x-0 bottom-0 h-full flex flex-col justify-between pointer-events-none opacity-10">
                  <div className="border-t border-on-surface w-full"></div>
                  <div className="border-t border-on-surface w-full"></div>
                  <div className="border-t border-on-surface w-full"></div>
                  <div className="border-t border-on-surface w-full"></div>
                </div>
                {/* Mock Bars */}
                {[
                  { label: '8주 전', h: 'h-32', bg: 'bg-surface-container-high group-hover:bg-primary' },
                  { label: '7주 전', h: 'h-40', bg: 'bg-surface-container-high group-hover:bg-primary' },
                  { label: '6주 전', h: 'h-36', bg: 'bg-surface-container-high group-hover:bg-primary' },
                  { label: 'Peak', h: 'h-52', bg: 'bg-primary', color: 'text-primary' },
                  { label: '4주 전', h: 'h-44', bg: 'bg-surface-container-high group-hover:bg-primary' },
                  { label: '3주 전', h: 'h-36', bg: 'bg-surface-container-high group-hover:bg-primary' },
                  { label: '2주 전', h: 'h-32', bg: 'bg-surface-container-high group-hover:bg-primary' },
                  { label: '현재', h: 'h-28', bg: 'bg-primary', color: 'text-primary' },
                ].map((bar, i) => (
                  <div key={i} className="w-12 group relative flex flex-col items-center">
                    <div className={`w-8 rounded-t-lg transition-all ${bar.bg} ${bar.h}`}></div>
                    <span className={`mt-3 text-[10px] font-${bar.color ? 'bold' : 'medium'} ${bar.color || ''}`}>{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive AI & Notes */}
          <div className="space-y-6">
            {/* Ask/Answer Interactive Panel */}
            <div className="bg-primary-container text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              <h5 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Icon name="auto_awesome" />
                Smart Insight AI
              </h5>
              <div className="space-y-4 mb-6 relative z-10">
                <button className="w-full text-left bg-white/10 hover:bg-white/20 p-3 rounded-xl text-xs font-medium transition-colors flex justify-between items-center group">
                  어느 지역에서 교환이 가장 많나요?
                  <Icon name="send" className="text-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button className="w-full text-left bg-white/10 hover:bg-white/20 p-3 rounded-xl text-xs font-medium transition-colors flex justify-between items-center group">
                  최근 리드타임 지연 원인이 무엇인가요?
                  <Icon name="send" className="text-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button className="w-full text-left bg-white/10 hover:bg-white/20 p-3 rounded-xl text-xs font-medium transition-colors flex justify-between items-center group">
                  이 상품의 재고 소진 예상 시점은?
                  <Icon name="send" className="text-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
              <div className="relative z-10">
                <input className="w-full bg-white/20 border-none rounded-lg py-3 px-4 text-xs placeholder:text-white/60 focus:ring-1 focus:ring-white/50" placeholder="직접 질문을 입력하세요..." type="text" />
              </div>
            </div>

            {/* Operational Notes */}
            <div className="bg-surface-container-lowest p-6 rounded-xl">
              <h5 className="text-sm font-bold mb-4 flex items-center gap-2">
                <Icon name="description" className="text-amber-500" />
                운영 특이사항 (Logs)
              </h5>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0"></div>
                  <div>
                    <p className="text-xs font-bold">2024.03.12</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">C사 물류센터 파업으로 인해 수도권 외곽 리드타임 +1.2일 증가.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0"></div>
                  <div>
                    <p className="text-xs font-bold">2024.03.05</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">색상 'Navy'의 원단 수급 문제로 추가 생산 일정 2주 지연 확정.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                  <div>
                    <p className="text-xs font-bold text-indigo-600">Action Taken</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">사이즈 교환 방지를 위한 상세 페이지 내 '실측 비교 가이드' 업데이트 완료.</p>
                  </div>
                </div>
              </div>
              <button className="w-full mt-6 py-2 border border-slate-100 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-slate-50 transition-colors">
                전체 로그 보기
              </button>
            </div>

            {/* Stock Status Quick View */}
            <div className="bg-surface-container-lowest p-6 rounded-xl">
              <h5 className="text-sm font-bold mb-4">옵션별 실시간 재고</h5>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">95 (M) / Black</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-error h-full w-[12%]"></div>
                    </div>
                    <span className="text-[10px] font-bold text-error">12개</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">100 (L) / Black</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-primary h-full w-[85%]"></div>
                    </div>
                    <span className="text-[10px] font-bold">412개</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">105 (XL) / Navy</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-primary h-full w-[45%]"></div>
                    </div>
                    <span className="text-[10px] font-bold">218개</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Action for Print/Export */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-50">
        <button className="w-14 h-14 bg-white shadow-2xl rounded-full flex items-center justify-center text-on-surface hover:scale-110 transition-transform border border-slate-100">
          <Icon name="print" />
        </button>
        <button className="w-14 h-14 bg-primary shadow-2xl rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform">
          <Icon name="download" />
        </button>
      </div>
    </div>
  );
};
