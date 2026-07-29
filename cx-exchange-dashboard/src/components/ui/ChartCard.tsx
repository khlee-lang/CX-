import React from 'react';

export interface ChartLegendItem {
  label: string;
  color: string; // hex
}

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** 우측 상단 커스텀 범례 (기존 Overview 스타일) */
  legend?: ChartLegendItem[];
  /** 우측 상단 액션 영역 (토글, 필터 등) — legend와 함께 쓰면 legend 왼쪽에 배치 */
  actions?: React.ReactNode;
  /** 차트 영역 높이(px). children을 이 높이의 div로 감싼다. 0이면 래핑 없음 */
  height?: number;
  dark?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  legend,
  actions,
  height = 300,
  dark = false,
  children,
  className = '',
}) => {
  return (
    <div
      className={`${
        dark ? 'bg-slate-900 text-white shadow-xl' : 'bg-white shadow-sm border border-slate-100'
      } p-8 rounded-[32px] ${className}`}
    >
      <div className="flex justify-between items-center mb-10">
        <div>
          <h4 className={`text-lg font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h4>
          {subtitle && (
            <p className={`text-xs font-bold mt-1 ${dark ? 'text-white/50' : 'text-slate-400'}`}>{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-6">
          {actions}
          {legend && (
            <div className="flex gap-6 uppercase text-[9px] font-black tracking-widest">
              {legend.map((l, i) => (
                <div key={i} className="flex items-center gap-2" style={{ color: l.color }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }}></span>
                  {l.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {height > 0 ? <div style={{ height }}>{children}</div> : children}
    </div>
  );
};
