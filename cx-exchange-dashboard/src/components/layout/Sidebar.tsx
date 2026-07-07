import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../ui/Icon';

const INACTIVE_CLASS = "flex items-center gap-3 px-3 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition-all";
const ACTIVE_CLASS = "flex items-center gap-3 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg transition-transform scale-95 active:scale-100";

const NAV_ITEMS = [
  { path: '/', icon: 'dashboard', label: '종합 대시보드' },
  { path: '/jasa-exchange', icon: 'store', label: '자사몰 교환 분석' },
  { path: '/oebu-exchange', icon: 'shopping_cart', label: '외부몰 교환 분석' },
  { path: '/defective-analysis', icon: 'report_problem', label: '불량 교환 분석' },
  { path: '/stuck-cases', icon: 'hourglass_empty', label: '교환 미처리 관리' },
  { path: '/exchange-performance', icon: 'trending_up', label: '교환 미처리 성과' },
  { path: '/low-stock-alerts', icon: 'inventory_2', label: '재고 부족 알림' },
  { path: '/product-detail', icon: 'analytics', label: '상품별 상세 분석' },
];

export const Sidebar: React.FC = () => {
  const navLinkClasses = ({ isActive }: { isActive: boolean }) => (isActive ? ACTIVE_CLASS : INACTIVE_CLASS);

  return (
    <aside className="fixed left-0 top-0 h-full w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col p-4 gap-2 z-50">
      <div className="mb-8 px-2">
        <h1 className="text-xl font-black text-indigo-700 dark:text-indigo-500">CX Dashboard</h1>
        <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-widest">Verish Exchange System</p>
      </div>
      
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={navLinkClasses}
          >
            <Icon name={item.icon} />
            <span className="text-sm tracking-tight">{item.label}</span>
          </NavLink>
        ))}
        
        <div className="pt-4 mt-4 border-t border-slate-200/60">
          <NavLink to="/report-center" className={({isActive}) => `flex items-center gap-3 px-4 py-3 font-bold rounded-xl text-sm tracking-tight transition-all duration-200 ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
            <Icon name="auto_awesome" className="text-lg" style={{ fontVariationSettings: "'FILL' 1" }} />
            <span className="text-sm tracking-tight">AI 리포트 센터</span>
          </NavLink>
        </div>

        <div className="pt-4 mt-2 border-t border-slate-200/60">
          <p className="px-3 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">자동화</p>
          <NavLink to="/reconcile" className={navLinkClasses}>
            <Icon name="sync_alt" />
            <span className="text-sm tracking-tight">반품-교환 연동</span>
          </NavLink>
          <NavLink to="/returns-sheet-maintenance" className={navLinkClasses}>
            <Icon name="build" />
            <span className="text-sm tracking-tight">반품 시트 관리</span>
          </NavLink>
        </div>
      </nav>
      
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <a className={INACTIVE_CLASS} href="#">
          <Icon name="settings" />
          <span className="text-sm tracking-tight">설정</span>
        </a>
        <a className={INACTIVE_CLASS} href="#">
          <Icon name="logout" />
          <span className="text-sm tracking-tight">로그아웃</span>
        </a>
      </div>
    </aside>
  );
};
