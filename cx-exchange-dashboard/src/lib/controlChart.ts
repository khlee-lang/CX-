import type { ExchangeHistoryData } from '../api/exchangeHistory';
import type { ShipmentData } from '../api/shipments';
import { isJasaScopedChannel } from './rate';
import { toISODate, normalizeChannel } from './exchange';

export type Granularity = 'day' | 'week' | 'month';
export type ChannelGroup = 'jasa' | 'oebu';

export interface RatePoint {
  bucket: string; // day: YYYY-MM-DD, week: 그 주 월요일, month: YYYY-MM
  label: string; // 화면 표시용 축약 라벨
  exchangeCnt: number;
  shippedQty: number | null;
  rate: number | null; // %
  /** 해당 버킷이 통계 밴드 계산에 쓰인 "신뢰 구간" 안에 있는지 */
  inBaseline: boolean;
  /** 교환 데이터 유실 구간(EXCHANGE_DATA_GAP)에 걸치는 버킷 — rate는 항상 null */
  dataGap: boolean;
}

// 옛날 교환 히스토리 시작(2024-05-28) 직후 몇 주는 "교환 접수 관행이 막 시작된
// 시점이라 실제보다 낮게 잡히는 시차 구간"이라 통계 기준선 계산에서 뺀다
// (실측: 2024-05-28~07-15 주간 교환율이 0~0.14%로 이후 정상 구간의 1/10 이하).
export const BASELINE_START = '2024-07-22';
// 히스토리 마지막 주(2026-01-05)는 반대로 "그 주 출고분 교환이 아직 다 안 들어온
// 마지막 구간"이라 낮게 잡힌다 — 마지막 완전한 주까지만 기준선에 포함.
export const BASELINE_END = '2025-12-29';

/**
 * 교환 데이터가 유실된 구간(강희님 확인, 2026-08-06: "1월 4월 데이터는 내가 잃어버려서 없어").
 *
 * 실측: 2026-01-06까지 정상 → 01-07~02월 0건 → 03월 1건 → 04월 398건(하루 18건, 정상 월의 약 10%)
 * → 05-04부터 라이브 시트로 정상 복귀. 즉 이 구간은 "교환이 줄어든 것"이 아니라 "기록이 없는 것".
 *
 * 출고량(분모)은 BigQuery에 계속 있어서, 방치하면 교환율이 0%에 가깝게 그려져 실제로
 * 급감한 것처럼 보인다. 그래서 이 구간에 걸치는 버킷은 rate를 null로 만들어
 * 선을 끊고(ControlChart의 connectNulls={false}) "데이터 없음"으로 표시한다.
 */
export const EXCHANGE_DATA_GAP = { start: '2026-01-07', end: '2026-05-03' };

interface DailyCount {
  exchangeCnt: number;
  defectCnt: number;
}

/** 라이브 구글시트(jasaMall/oebuMall 행 배열)를 일별×채널그룹 건수로 변환 */
export const buildLiveDailyExchange = (
  jasaRows: Record<string, any>[],
  oebuRows: Record<string, any>[],
): Map<string, Record<ChannelGroup, DailyCount>> => {
  const map = new Map<string, Record<ChannelGroup, DailyCount>>();
  const bump = (date: string, grp: ChannelGroup) => {
    if (!map.has(date)) map.set(date, { jasa: { exchangeCnt: 0, defectCnt: 0 }, oebu: { exchangeCnt: 0, defectCnt: 0 } });
    map.get(date)![grp].exchangeCnt += 1;
  };
  const dateOf = (r: Record<string, any>): string | null => {
    const raw = (r['접수일'] || '').replace(/\./g, '-');
    const m = /^\d{4}-\d{2}-\d{2}/.exec(raw);
    return m ? m[0] : null;
  };
  jasaRows.forEach((r) => {
    const d = dateOf(r);
    if (d) bump(d, 'jasa');
  });
  oebuRows.forEach((r) => {
    const d = dateOf(r);
    if (!d) return;
    bump(d, isJasaScopedChannel(r['채널명']) ? 'jasa' : 'oebu');
  });
  return map;
};

const bucketOf = (date: string, granularity: Granularity): string => {
  if (granularity === 'day') return date;
  if (granularity === 'month') return date.slice(0, 7);
  // week: 그 주의 월요일 (KST 기준 날짜 문자열이라 UTC 파싱으로 요일 계산해도 안전)
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=일 ... 1=월
  const diff = (day + 6) % 7; // 월요일까지 거슬러 갈 일수
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
};

const labelOf = (bucket: string, granularity: Granularity): string =>
  granularity === 'month' ? bucket : bucket.slice(5);

/** 버킷 문자열(일/주/월) → 실제 캘린더 날짜 구간(양끝 포함). 드릴다운 조회 범위 계산용. */
export const bucketDateRange = (bucket: string, granularity: Granularity): { start: string; end: string } => {
  if (granularity === 'day') return { start: bucket, end: bucket };
  if (granularity === 'week') {
    const d = new Date(`${bucket}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 6);
    return { start: bucket, end: d.toISOString().slice(0, 10) };
  }
  const [y, m] = bucket.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${bucket}-01`, end: `${bucket}-${String(lastDay).padStart(2, '0')}` };
};

/**
 * 채널그룹 하나(jasa|oebu)의 통합 시계열을 만든다.
 * 출고 데이터: shipments.byDay(라이브+과거 UNION 이미 됨)
 * 교환 데이터: exchangeHistory(과거, 2024-05-28~2026-01-06) + 라이브 시트(현재 조회기간)
 */
export const buildRateSeries = (
  grp: ChannelGroup,
  granularity: Granularity,
  shipments: ShipmentData | null,
  exchangeHistory: ExchangeHistoryData | null,
  liveDaily: Map<string, Record<ChannelGroup, DailyCount>>,
): RatePoint[] => {
  const shipMap = new Map<string, number>();
  shipments?.byDay.forEach((r) => {
    if (r.channelGroup !== grp) return;
    shipMap.set(r.date, (shipMap.get(r.date) || 0) + r.qty);
  });

  const exchMap = new Map<string, number>();
  exchangeHistory?.byDay.forEach((r) => {
    if (r.channelGroup !== grp) return;
    exchMap.set(r.date, (exchMap.get(r.date) || 0) + r.exchangeCnt);
  });
  liveDaily.forEach((counts, date) => {
    const v = counts[grp].exchangeCnt;
    if (v > 0) exchMap.set(date, (exchMap.get(date) || 0) + v);
  });

  const allDates = new Set([...shipMap.keys(), ...exchMap.keys()]);

  const buckets = new Map<string, { exch: number; ship: number; days: Set<string> }>();
  for (const date of allDates) {
    const b = bucketOf(date, granularity);
    if (!buckets.has(b)) buckets.set(b, { exch: 0, ship: 0, days: new Set() });
    const entry = buckets.get(b)!;
    entry.exch += exchMap.get(date) || 0;
    entry.ship += shipMap.get(date) || 0;
    entry.days.add(date);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, v]) => {
      // 유실 구간에 조금이라도 걸치면 교환건수가 실제보다 적어 교환율이 왜곡되므로
      // 부분적으로 걸친 버킷까지 전부 "데이터 없음"으로 처리한다(보수적).
      const range = bucketDateRange(bucket, granularity);
      const dataGap = range.start <= EXCHANGE_DATA_GAP.end && range.end >= EXCHANGE_DATA_GAP.start;
      return {
        bucket,
        label: labelOf(bucket, granularity),
        exchangeCnt: v.exch,
        shippedQty: v.ship > 0 ? v.ship : null,
        rate: dataGap || v.ship <= 0 ? null : (v.exch / v.ship) * 100,
        inBaseline: granularity === 'week' && bucket >= BASELINE_START && bucket <= BASELINE_END,
        dataGap,
      };
    });
};

export interface Band {
  mean: number;
  stdDev: number;
  upper: number;
  lower: number;
  sampleSize: number;
}

/** 기준선 구간(BASELINE_START~BASELINE_END, 주 단위)의 평균±2σ */
export const computeBand = (series: RatePoint[]): Band | null => {
  const rates = series.filter((p) => p.inBaseline && p.rate !== null).map((p) => p.rate as number);
  if (rates.length < 8) return null; // 표본이 너무 적으면 밴드 자체를 안 보여준다
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / (rates.length - 1);
  const stdDev = Math.sqrt(variance);
  return { mean, stdDev, upper: mean + 2 * stdDev, lower: Math.max(0, mean - 2 * stdDev), sampleSize: rates.length };
};

export interface DrilldownResult {
  range: { start: string; end: string };
  channelGroup: ChannelGroup;
  totalCount: number;
  topProducts: { name: string; cnt: number }[];
  reasonDistribution: { reason: string; cnt: number }[];
}

/**
 * 관제 그래프 밴드초과 지점 드릴다운(라이브 구글시트 구간용).
 * 교환건수 집계는 buildLiveDailyExchange와 동일하게 자사몰/외부몰 교환시트만 대상으로 한다
 * (그래프에 찍히는 교환율 자체가 이 두 시트 기준이라 TOP 상품도 같은 기준이어야 앞뒤가 맞음).
 * 불량 사유 분포는 참고 정보로 별도 시트([불량] 교환)에서 같은 기간·채널 기준으로 뽑는다.
 */
export const computeLiveDrilldown = (
  jasaRows: Record<string, any>[],
  oebuRows: Record<string, any>[],
  bulryangRows: Record<string, any>[],
  start: string,
  end: string,
  grp: ChannelGroup,
): DrilldownResult => {
  const inRange = (r: Record<string, any>): boolean => {
    const d = toISODate(r['접수일']);
    return d !== null && d >= start && d <= end;
  };

  const exchangeRows: Record<string, any>[] = [];
  if (grp === 'jasa') {
    jasaRows.filter(inRange).forEach((r) => exchangeRows.push(r));
  }
  oebuRows.filter(inRange).forEach((r) => {
    const g: ChannelGroup = isJasaScopedChannel(r['채널명']) ? 'jasa' : 'oebu';
    if (g === grp) exchangeRows.push(r);
  });

  const prodMap = new Map<string, number>();
  exchangeRows.forEach((r) => {
    const name = (r['상품명'] || '').trim();
    if (!name) return;
    prodMap.set(name, (prodMap.get(name) || 0) + 1);
  });
  const topProducts = [...prodMap.entries()]
    .map(([name, cnt]) => ({ name, cnt }))
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, 5);

  const bulryangInRange = bulryangRows.filter(inRange).filter((r) => {
    const g: ChannelGroup = normalizeChannel(r['교환 형태 및 채널']) === '자사몰' ? 'jasa' : 'oebu';
    return g === grp;
  });
  const reasonMap = new Map<string, number>();
  bulryangInRange.forEach((r) => {
    const reason = (r['불량 사유'] || '').trim();
    if (!reason) return;
    reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
  });
  const reasonDistribution = [...reasonMap.entries()]
    .map(([reason, cnt]) => ({ reason, cnt }))
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, 8);

  return { range: { start, end }, channelGroup: grp, totalCount: exchangeRows.length, topProducts, reasonDistribution };
};
