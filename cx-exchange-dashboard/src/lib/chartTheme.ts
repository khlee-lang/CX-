// recharts 공통 스타일 — 페이지마다 복붙되던 축/그리드/툴팁 설정의 단일 출처.
// 사용: <XAxis {...AXIS_PROPS} dataKey="date" /> 처럼 spread 후 필요한 것만 덮어쓴다.

export const AXIS_TICK = { fontSize: 10, fontWeight: 800, fill: '#94a3b8' } as const;

export const AXIS_PROPS = {
  axisLine: false,
  tickLine: false,
  tick: AXIS_TICK,
} as const;

export const GRID_PROPS = {
  strokeDasharray: '3 3',
  vertical: false,
  stroke: '#f1f5f9',
} as const;

export const TOOLTIP_STYLE = {
  borderRadius: '16px',
  border: 'none',
  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
} as const;

export const TOOLTIP_CURSOR = { stroke: '#e2e8f0', strokeWidth: 1 } as const;

// 교환율/불량률처럼 소수점이 긴 값이 툴팁에 그대로 노출되지 않도록 포맷.
// 이름에 '%'가 들어간 시리즈는 소수 1자리, 나머지는 천단위 구분.
export const rateTooltipFormatter = (value: unknown, name: unknown): [string, string] => {
  const label = String(name ?? '');
  // null/빈값은 Number()가 0으로 바꿔버리므로 먼저 걸러낸다 (출고 데이터 없는 날짜 = '—')
  if (value === null || value === undefined || value === '') return ['—', label];
  const num = Number(value);
  if (!Number.isFinite(num)) return ['—', label];
  return [label.includes('%') ? `${num.toFixed(1)}%` : num.toLocaleString(), label];
};

// 채널 시리즈 고정 색 (자사몰/외부몰/불량)
export const SERIES_COLORS = {
  jasa: '#6366f1',
  oebu: '#f97316',
  bulryang: '#ef4444',
  shipped: '#e2e8f0', // 출고량 Bar (연회색 배경 시리즈)
} as const;
