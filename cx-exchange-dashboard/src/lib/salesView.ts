// 세일즈 뷰(주차별 상품 교환율) 집계 로직
//
// 교환 분자: 라이브 구글시트 [자사몰] 교환 + [외부몰] 중 네이버페이(자사몰 비회원,
//   출고량이 카페24(신)에 포함되므로 분자도 자사몰로 — rate.ts 주석 참고)
// 출고 분모: shipments API의 byProductWeek (?weekly=1, 자사몰=카페24(신))
// 주차 귀속: 접수일 기준, 주 시작 = 월요일 (사용자 확정 2026-08-05)
import type { ShipmentByProductWeek } from '../api/shipments';
import { normalizeExact, normalizeLoose, isJasaScopedChannel } from './rate';
import { toISODate } from './exchange';

// 라이브 교환 시트 데이터 시작일 — 이전 주차는 교환건수가 0으로 왜곡되므로 안 보여준다.
// (과거 히스토리 테이블은 상품 단위 API가 없어 세일즈 뷰 범위 밖)
export const LIVE_EXCHANGE_MIN_DATE = '2026-05-04';

export const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 그 주의 월요일 (KST 날짜 문자열 → UTC 파싱으로 요일 계산해도 안전, controlChart와 동일) */
export const mondayOf = (dateISO: string): string => {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const diff = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
};

/** 최근 주차 목록(월요일 ISO, 오름차순). 마지막 원소는 진행 중인 이번 주. */
export const recentWeeks = (todayISO: string, maxCompleteWeeks = 12): string[] => {
  const cur = mondayOf(todayISO);
  const weeks: string[] = [cur];
  let w = cur;
  for (let i = 0; i < maxCompleteWeeks; i++) {
    w = addDays(w, -7);
    if (w < LIVE_EXCHANGE_MIN_DATE) break;
    weeks.unshift(w);
  }
  return weeks;
};

export const weekLabel = (monday: string): string =>
  `${monday.slice(5).replace('-', '/')}~${addDays(monday, 6).slice(5).replace('-', '/')}`;

/** "6월 3주차" — 그 주 월요일이 속한 달에서 몇 번째 월요일인지로 센다 */
export const weekTitle = (monday: string): string => {
  const month = Number(monday.slice(5, 7));
  const day = Number(monday.slice(8, 10));
  const nth = Math.floor((day - 1) / 7) + 1;
  return `${month}월 ${nth}주차`;
};

export interface WeekCell {
  exchangeCnt: number;
  shipped: number | null; // null = 그 주 출고 매칭 실패(출고 0 포함)
  rate: number | null; // %
}

export interface SalesProductRow {
  name: string;
  totalExchanges: number; // 조회창 전체 교환건수
  cells: Record<string, WeekCell>; // week(월요일) → 셀
}

export interface SalesMatrix {
  weeks: string[];
  rows: SalesProductRow[];
  /** 주차별 자사몰 전체 (분모는 교환 발생 여부와 무관하게 전 상품 합) */
  weekTotals: Record<string, { exchangeCnt: number; shipped: number }>;
}

/**
 * 주차×상품 매트릭스. 조회창 안에서 교환이 1건이라도 있는 상품만 행으로 만든다
 * (교환 0건 상품은 워스트 랭킹·히트맵 어디에도 못 올라가므로).
 */
export const buildSalesMatrix = (
  jasaRows: Record<string, any>[],
  oebuRows: Record<string, any>[],
  byProductWeek: ShipmentByProductWeek[] | undefined,
  weeks: string[],
): SalesMatrix => {
  const weekSet = new Set(weeks);

  // 출고 인덱스: `${week}|${정규화명}` → qty (자사몰만). exact 우선, loose는 fallback.
  const shipExact = new Map<string, number>();
  const shipLoose = new Map<string, number>();
  const weekTotals: Record<string, { exchangeCnt: number; shipped: number }> = {};
  weeks.forEach((w) => (weekTotals[w] = { exchangeCnt: 0, shipped: 0 }));

  (byProductWeek || []).forEach((r) => {
    if (r.channelGroup !== 'jasa' || !weekSet.has(r.week)) return;
    const ek = `${r.week}|${normalizeExact(r.name)}`;
    const lk = `${r.week}|${normalizeLoose(r.name)}`;
    shipExact.set(ek, (shipExact.get(ek) || 0) + r.qty);
    shipLoose.set(lk, (shipLoose.get(lk) || 0) + r.qty);
    weekTotals[r.week].shipped += r.qty;
  });

  // 교환 분자: 상품×주차 건수
  const exch = new Map<string, Map<string, number>>(); // name → (week → cnt)
  const bump = (row: Record<string, any>) => {
    const date = toISODate(row['접수일']);
    if (!date) return;
    const w = mondayOf(date);
    if (!weekSet.has(w)) return;
    const name = (row['상품명'] || '').trim();
    if (!name) return;
    if (!exch.has(name)) exch.set(name, new Map());
    const m = exch.get(name)!;
    m.set(w, (m.get(w) || 0) + 1);
    weekTotals[w].exchangeCnt += 1;
  };
  jasaRows.forEach(bump);
  oebuRows.forEach((r) => {
    if (isJasaScopedChannel(r['채널명'])) bump(r);
  });

  const lookupShipped = (week: string, name: string): number | null => {
    const v = shipExact.get(`${week}|${normalizeExact(name)}`) ?? shipLoose.get(`${week}|${normalizeLoose(name)}`);
    return v != null && v > 0 ? v : null;
  };

  const rows: SalesProductRow[] = [...exch.entries()].map(([name, byWeek]) => {
    const cells: Record<string, WeekCell> = {};
    let total = 0;
    weeks.forEach((w) => {
      const cnt = byWeek.get(w) || 0;
      total += cnt;
      const shipped = lookupShipped(w, name);
      cells[w] = { exchangeCnt: cnt, shipped, rate: shipped ? (cnt / shipped) * 100 : null };
    });
    return { name, totalExchanges: total, cells };
  });

  rows.sort((a, b) => b.totalExchanges - a.totalExchanges);
  return { weeks, rows, weekTotals };
};
