import React from 'react';
import { Icon } from '../components/ui/Icon';

const REPORT_LIST = [
  { title: '2024.05.21 Daily Logistics Report', date: 'May 21, 2024', author: 'AI Agent', authorIcon: 'auto_awesome', authorColor: 'text-primary bg-indigo-100', status: 'Shared', statusColor: 'bg-tertiary-fixed/30 text-on-tertiary-fixed-variant' },
  { title: '2024.05.20 Daily Logistics Report', date: 'May 20, 2024', author: 'Lee Min-ho', authorImg: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASQl5yPn4gjdy8LUZsx_t5kGYlTTTFDph0FqV3JEi6J1-E1s0RlahDllAyUTYZYbQyovRZyuzOmIRWKyYnuo7a33upbPmSl3uDmddokfnVBUIieImwoSYn1ND9DVhaKlJlWAi-vz31NfzhpNwAO81QEh0D2_0OO3nPFpUnAqmOGtVdy5ynMR6bziIWpuO3bbjJyWuRkz36DwikkfpAKdfG3DjlhNQmqOXGLxhJ009Sep3v64Nsk8o6zWJmuRCwiE5AGV1r7ee5Qlk', status: 'Approved', statusColor: 'bg-primary-fixed/30 text-on-primary-fixed-variant' },
  { title: '2024.05.19 Daily Logistics Report', date: 'May 19, 2024', author: 'AI Agent', authorIcon: 'auto_awesome', authorColor: 'text-primary bg-indigo-100', status: 'Draft', statusColor: 'bg-surface-container-highest text-on-surface-variant' },
];

export const ReportCenter: React.FC = () => {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full relative pb-12">
      {/* Header Area */}
      <header className="bg-surface-container-lowest/80 backdrop-blur-md border border-slate-100 rounded-2xl flex flex-wrap justify-between items-center px-8 py-4 shadow-sm relative z-30">
        <div className="flex items-center gap-8 mb-4 md:mb-0">
          <h2 className="text-lg font-semibold font-headline text-slate-900">리포트 센터</h2>
          <nav className="flex gap-6 h-full items-center">
            <button className="text-indigo-600 border-b-2 border-indigo-600 pb-1 text-sm font-medium h-full flex items-center">Daily</button>
            <button className="text-slate-500 hover:text-indigo-500 transition-opacity text-sm font-medium h-full flex items-center">Weekly</button>
            <button className="text-slate-500 hover:text-indigo-500 transition-opacity text-sm font-medium h-full flex items-center">Monthly</button>
          </nav>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative group flex-1 md:flex-none">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input className="pl-10 pr-4 py-1.5 text-sm bg-surface-container-low border-none rounded-full focus:ring-2 focus:ring-primary/20 w-full md:w-64 transition-all" placeholder="Search reports..." type="text" />
          </div>
          <button className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap shadow-sm">
            <Icon name="add" className="text-sm" /> Generate AI Report
          </button>
        </div>
      </header>

      {/* KPI Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg text-primary"><Icon name="description" /></div>
            <span className="text-xs text-tertiary-container font-semibold bg-tertiary-fixed/30 px-2 py-0.5 rounded-full">+12% vs LW</span>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Total Reports Generated</p>
          <h3 className="text-3xl font-bold font-headline text-slate-900 tracking-tight">1,284</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg text-primary"><Icon name="auto_awesome" /></div>
            <span className="text-xs text-indigo-700 font-semibold bg-indigo-100 px-2 py-0.5 rounded-full">High</span>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">AI Accuracy Score</p>
          <h3 className="text-3xl font-bold font-headline text-slate-900 tracking-tight">98.2%</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-rose-50 rounded-lg text-error"><Icon name="pending_actions" /></div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Pending Approval</p>
          <h3 className="text-3xl font-bold font-headline text-error tracking-tight">12</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Icon name="share" /></div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Shared with Stakeholders</p>
          <h3 className="text-3xl font-bold font-headline text-slate-900 tracking-tight">842</h3>
        </div>
      </section>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Report List Section */}
        <section className="col-span-1 lg:col-span-2 space-y-4">
          <div className="bg-surface-container-lowest rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-6">
                <button className="text-sm font-bold text-primary border-b-2 border-primary pb-4 -mb-[17px]">데일리 리포트</button>
                <button className="text-sm font-medium text-slate-500 hover:text-slate-900 pb-4 -mb-[17px] transition-colors">주간 리포트</button>
                <button className="text-sm font-medium text-slate-500 hover:text-slate-900 pb-4 -mb-[17px] transition-colors">월간 리포트</button>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"><Icon name="filter_list" className="text-sm" /></button>
                <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"><Icon name="download" className="text-sm" /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-100 font-label">Report Title</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-100 font-label">Date</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-100 font-label">Author</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-100 font-label">Status</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-100 font-label text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {REPORT_LIST.map((report, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Icon name="article" className="text-primary text-xl" />
                          <span className="text-sm font-bold text-slate-900">{report.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="text-sm text-slate-600 font-medium">{report.date}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {report.authorImg ? (
                            <div className="w-6 h-6 bg-slate-100 rounded-full overflow-hidden">
                              <img src={report.authorImg} alt="Author" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${report.authorColor}`}>
                              <Icon name={report.authorIcon || 'person'} className="text-[12px]" />
                            </div>
                          )}
                          <span className="text-sm font-medium text-slate-700">{report.author}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${report.statusColor}`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"><Icon name="visibility" className="text-sm" /></button>
                          <button className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"><Icon name="edit" className="text-sm" /></button>
                          <button className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"><Icon name="share" className="text-sm" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-center bg-slate-50/30">
              <button className="text-xs font-bold text-indigo-600 hover:underline">View All Reports</button>
            </div>
          </div>
        </section>

        {/* Sidebar Cards */}
        <aside className="col-span-1 space-y-6">
          {/* AI Insight Preview Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-primary-container p-1 shadow-xl shadow-indigo-600/20">
            <div className="bg-indigo-600/90 backdrop-blur-sm rounded-[10px] p-6 text-white h-full relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <Icon name="auto_awesome" className="text-indigo-200" />
                <h4 className="font-headline font-bold text-sm uppercase tracking-wide">주요 인사이트 요약</h4>
              </div>
              <div className="space-y-4 relative z-10">
                <div className="bg-white/10 rounded-lg p-4 border border-white/20 backdrop-blur-md">
                  <p className="text-xs text-indigo-200 mb-2 font-semibold">핵심 이슈</p>
                  <p className="text-sm font-bold leading-relaxed text-white">C-Logistics 센터에서 대규모 출고 지연 발생 (평균 4.2시간 증가)</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 border border-white/20 backdrop-blur-md">
                  <p className="text-xs text-indigo-200 mb-2 font-semibold">AI 권장사항</p>
                  <p className="text-sm font-bold leading-relaxed text-white">익일 배송 물량을 인근 D-Center로 우회 배정하여 병목 현상 완화 필요</p>
                </div>
              </div>
              <button className="w-full mt-6 py-3 bg-white text-indigo-700 rounded-lg text-sm font-bold hover:bg-slate-50 hover:shadow-lg transition-all active:scale-95 shadow-md">
                상세 인사이트 확인하기
              </button>
              {/* decorative blur */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl pointer-events-none z-0"></div>
            </div>
          </div>

          {/* Automation Settings */}
          <div className="bg-surface-container-lowest rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Icon name="settings_suggest" className="text-slate-500" />
              <h4 className="font-bold text-sm text-slate-900">Automation Settings</h4>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100/50">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-slate-800">AI 자동 초안 작성</p>
                  <p className="text-[11px] font-medium text-slate-500">매일 오전 9시 리포트 생성</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100/50">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-slate-800">이메일 자동 공유</p>
                  <p className="text-[11px] font-medium text-slate-500">승인 즉시 이해관계자 발송</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
            <div className="mt-6">
              <div className="relative w-full h-32 rounded-lg overflow-hidden group cursor-pointer shadow-sm border border-slate-200">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5-vB5ffAmiIpJHBP3FfWwQczu5hANBTVHyZgozWv5lw4iLzKSB3dYQUrn0gww0uXzVDqnwVowziF5uKytmBSekMsT07ixhN6ashV3ygKa2Nqo1JK4LxIPU7ZrlvYLMAh4bvy-REDRzSgnSef5vVIHzJ1jM50ZDFhXIwt69HcvwJ-PAyEHSDk0vJU8MYDK5YeCzb-76CMzwHlbIeRScpQyHkXyrDocW8tqDcaeF4fg_PoTPDOoKWpO3zmupZ5OTausFHcSitmCE7w" alt="Dashboard Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex items-end p-4">
                  <span className="text-white text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">전체 자동화 가이드 확인 <Icon name="arrow_forward" className="text-[12px]" /></span>
                </div>
              </div>
            </div>
          </div>

          {/* Support Card */}
          <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 flex items-center gap-4 hover:bg-indigo-50 transition-colors cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm text-indigo-600 group-hover:scale-110 group-hover:shadow-md transition-all">
              <Icon name="help_center" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-950 mb-0.5">도움이 필요하신가요?</p>
              <p className="text-xs font-medium text-indigo-700/70">AI 리포트 설정 가이드를 확인하세요.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
