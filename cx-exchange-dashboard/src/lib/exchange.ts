// 교환 데이터 공용 유틸리티
// 시트 원본 데이터의 지저분한 값(출고일 특수값, 옵션 문자열, 불량 사유)을
// 대시보드 4개 페이지가 동일한 기준으로 해석하도록 한 곳에 모음.

// ── 날짜 ──────────────────────────────────────────────────────
const DATE_RE = /^\d{4}[-.]\d{2}[-.]\d{2}/;

export const toISODate = (v?: string): string | null => {
  if (!v) return null;
  const m = v.trim().match(DATE_RE);
  return m ? m[0].replace(/\./g, '-') : null;
};

// ── 출고 상태 ─────────────────────────────────────────────────
// 출고일 열의 실제 값: 날짜 / 빈값 / '-' / '입고MMDD(재고)' / '미입고' / 메모성 텍스트
export type ShipStatus = 'shipped' | 'waitingStock' | 'notReceived' | 'pending' | 'hold';

export const shipStatus = (row: Record<string, any>): ShipStatus => {
  const v = (row['출고일'] || '').trim();
  if (DATE_RE.test(v)) return 'shipped';
  if (!v || v === '-' || v === '.-') return 'pending';
  if (v.startsWith('입고')) return 'waitingStock'; // 재고 입고 대기
  if (v.includes('미입고')) return 'notReceived'; // 고객 반품 미입고
  return 'hold'; // 확인중·보류 등 메모
};

export const isShipped = (row: Record<string, any>) => shipStatus(row) === 'shipped';

// 회수내역이 '미집화'(반송장 미생성 포함) 상태면 아직 택배사가 원물을 수거하지 않은 것 —
// 접수일 기준 며칠 지났는지와 함께 봐야 "지연"인지 "정상 대기중"인지 판단 가능
export const needsRecovery = (row: Record<string, any>): boolean =>
  (row['회수내역'] || '').trim().startsWith('미집화');

// 택배비 열에서 숫자만 추출 ('6,000', '6000', '' 등 혼재)
export const shippingFee = (row: Record<string, any>): number => {
  const n = parseInt((row['택배비'] || '').replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
};

// 접수일→출고일 리드타임 (둘 다 날짜일 때만, 일 단위)
export const leadTimeDays = (row: Record<string, any>): number | null => {
  const a = toISODate(row['접수일']);
  const b = toISODate(row['출고일']);
  if (!a || !b) return null;
  const days = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return days >= 0 && days <= 120 ? days : null;
};

export const median = (arr: number[]): number | null => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// ── 옵션 파싱: "[블랙-M]" → { color: '블랙', size: 'M' } ────────
const SIZE_RANK: Record<string, number> = {
  XS: 10, SS: 15, S: 20, 'S-M': 25, 'S/M': 25, M: 30, MM: 35, 'M-L': 37, 'M/L': 37,
  L: 40, LL: 45, 'L-XL': 47, XL: 50, XLL: 55, XXL: 60, '2XL': 60, '3XL': 70,
};
const BRA_RE = /^(\d{2})(\d{2})?(AB|BC|CD|A|B|C|D)$/; // 7580A, 85A 등

export const parseOption = (opt?: string): { color: string; size: string } | null => {
  if (!opt) return null;
  const v = opt.trim().replace(/^[[(]|[\])]$/g, '');
  if (!v) return null;
  const tokens = v.split('-');
  if (tokens.length < 2) return null;
  // 사이즈가 'L-XL'처럼 두 토큰일 수 있어 뒤 2개 결합을 먼저 시도
  const last2 = tokens.slice(-2).join('-');
  if (tokens.length >= 3 && SIZE_RANK[last2] !== undefined) {
    return { color: tokens.slice(0, -2).join('-'), size: last2 };
  }
  const last = tokens[tokens.length - 1];
  if (SIZE_RANK[last] !== undefined || BRA_RE.test(last)) {
    return { color: tokens.slice(0, -1).join('-'), size: last };
  }
  return null;
};

const sizeRank = (size: string): number | null => {
  if (SIZE_RANK[size] !== undefined) return SIZE_RANK[size];
  const m = size.match(BRA_RE);
  if (m) {
    const band = parseInt(m[1], 10);
    const cup = { A: 1, AB: 1.5, B: 2, BC: 2.5, C: 3, CD: 3.5, D: 4 }[m[3]] || 0;
    return band * 10 + cup; // 밴드 우선, 같으면 컵 비교
  }
  return null;
};

// 교환 방향: 사이즈업 / 사이즈다운 / 색상만 변경 / 동일옵션 재출고
export type SwapDirection = 'sizeUp' | 'sizeDown' | 'colorOnly' | 'same' | 'both' | 'unknown';

export const swapDirection = (row: Record<string, any>): SwapDirection => {
  const from = parseOption(row['교환 전 옵션']);
  const to = parseOption(row['교환 출고 옵션']);
  if (!from || !to) return 'unknown';
  const sameColor = from.color === to.color;
  const rf = sizeRank(from.size);
  const rt = sizeRank(to.size);
  const sameSize = from.size === to.size;
  if (sameColor && sameSize) return 'same';
  if (sameColor && rf !== null && rt !== null) return rt > rf ? 'sizeUp' : rt < rf ? 'sizeDown' : 'same';
  if (!sameColor && sameSize) return 'colorOnly';
  if (!sameColor && !sameSize) return 'both';
  return 'unknown';
};

// ── 불량 사유 분류 ─────────────────────────────────────────────
// 실데이터 사유값 기준의 단일 분류(중복 집계 없음).
// group: product(제품 결함) / ops(운영·물류 오류) / nonDefect(비불량) / unknown(확인필요)
export type DefectGroup = 'product' | 'ops' | 'nonDefect' | 'unknown';

export interface DefectCategory {
  key: string;
  name: string;
  group: DefectGroup;
  color: string;
  keywords: string[];
}

export const DEFECT_CATEGORIES: DefectCategory[] = [
  // 제품 결함 — 생산/QC 팀 액션 대상
  { key: 'fabric', name: '원단 (올트임·냄새)', group: 'product', color: '#e11d48', keywords: ['올트임', '원단', '냄새'] },
  { key: 'pad', name: '패드·접착', group: 'product', color: '#f97316', keywords: ['패드', '접착'] },
  { key: 'sewing', name: '봉제·부자재', group: 'product', color: '#8b5cf6', keywords: ['봉제', '후크', '스트랩', '지퍼', '부자재'] },
  { key: 'contamination', name: '오염·이물질', group: 'product', color: '#0ea5e9', keywords: ['오염', '이물질'] },
  { key: 'comfort', name: '착용감·실측사이즈', group: 'product', color: '#10b981', keywords: ['따가움', '트러블', '실측', '사이즈불량'] },
  { key: 'etcDefect', name: '기타 제품불량', group: 'product', color: '#64748b', keywords: ['불량'] }, // 위에 안 걸린 'XX불량'
  // 운영·물류 오류 — CX/물류 팀 액션 대상
  { key: 'ops', name: '운영·물류 오류', group: 'ops', color: '#f59e0b', keywords: ['전산', '내품', '오출고', '배송', '패키지', '누락', '오배송'] },
  // 비불량 — 불량 시트에 섞인 변심·사용 후 클레임
  { key: 'nonDefect', name: '변심·착용 후', group: 'nonDefect', color: '#94a3b8', keywords: ['변심', '세탁', '착용'] },
];

export const classifyDefect = (reason?: string): DefectCategory | null => {
  const r = (reason || '').trim();
  if (!r || r.includes('확인필요') || r.includes('확인 필요')) return null; // unknown
  // 비불량·운영 오류를 먼저 판정 ('세탁/착용 후 불량'이 etcDefect로 새는 것 방지)
  const priority = ['nonDefect', 'ops', 'fabric', 'pad', 'sewing', 'contamination', 'comfort', 'etcDefect'];
  for (const key of priority) {
    const cat = DEFECT_CATEGORIES.find(c => c.key === key)!;
    if (cat.keywords.some(k => r.includes(k))) return cat;
  }
  return null;
};

// ── 채널 정규화 ────────────────────────────────────────────────
// 불량 시트의 '교환 형태 및 채널': '(불)선교환'·'(불)교환'·'(불)추가교환'·'철회' = 자사몰
export const normalizeChannel = (v?: string): string => {
  const c = (v || '').trim();
  if (!c) return '기타';
  if (c.startsWith('(불)') || c === '철회') return '자사몰';
  return c;
};
