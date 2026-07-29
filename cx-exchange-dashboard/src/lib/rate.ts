import type { ShipmentData, ChannelGroup } from '../api/shipments';

// ─────────────────────────────────────────────────────────────
// 상품명 정규화 — 교환 시트 '상품명' ↔ BigQuery name 매칭
//
// 2단계 lookup을 쓴다 (2026-07 실측 매칭률: 건수 기준 99.5%):
//  1) exact: 소문자화 + 공백 제거 + 괄호 통일
//  2) loose: exact 실패 시에만 — 시즌표기((26SS), _26SS)와 끝의 버전(2.0/3.0) 제거.
//     BigQuery에 '티셔츠 브라 볼륨'과 '티셔츠 브라 볼륨 2.0'이 공존하는 케이스가
//     있어 loose를 무조건 쓰면 다른 상품이 합산된다. exact 우선이 필수.
// ─────────────────────────────────────────────────────────────

export const normalizeExact = (s?: string | null): string =>
  (s || '')
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, '')
    .replace(/[［（]/g, '(')
    .replace(/[］）]/g, ')');

export const normalizeLoose = (s?: string | null): string =>
  normalizeExact(s)
    .replace(/\(?26ss\)?/g, '')
    .replace(/_/g, '')
    .replace(/\d+\.\d+$/, '');

// ─────────────────────────────────────────────────────────────
// 시트 채널명 → BigQuery sales_channel 매핑 (2026-07 실데이터 대조로 확정)
// BQ 채널: 카페24(신), 무신사, 스마트스토어, 에이블리, 지그재그-포스티,
//          카카오 선물하기, W컨셉, 올리브영_온라인(딥다이브), 29CM, NUGU(딥다이브)
// ─────────────────────────────────────────────────────────────

const CHANNEL_MAP: Record<string, string> = {
  지그재그: '지그재그-포스티',
  카카오선물하기: '카카오 선물하기',
  올리브영: '올리브영_온라인(딥다이브)',
};

/**
 * 시트에서는 [외부몰] 교환에 기재되지만 **실제로는 자사몰(카페24) 주문**인 채널.
 *
 * `네이버페이`는 자사몰 비회원 주문의 결제수단이라(운영 확인), 출고 데이터에서는
 * 별도 채널 없이 `카페24(신)`에 포함된다(BigQuery 전체 조회로 확인, 2026-07).
 * 따라서 교환율을 낼 때 분자를 자사몰 쪽으로 옮겨야 분모(카페24 출고량)와 범위가 맞는다.
 * 이 처리를 하지 않으면 자사몰 교환율은 과소, 외부몰 교환율은 과대 집계된다.
 *
 * 개별 채널 교환율은 출고량을 카페24에서 분리할 수 없어 산출 불가('—')다.
 */
export const JASA_SCOPED_OEBU_CHANNELS = new Set(['네이버페이']);

export const isJasaScopedChannel = (sheetChannel?: string): boolean =>
  JASA_SCOPED_OEBU_CHANNELS.has((sheetChannel || '').trim());

export const mapSheetChannelToBQ = (sheetChannel?: string): string => {
  const key = (sheetChannel || '').trim();
  return CHANNEL_MAP[key] ?? key;
};

// ─────────────────────────────────────────────────────────────
// 교환율 계산
// ─────────────────────────────────────────────────────────────

export interface RateResult {
  exchanges: number;
  shipped: number | null; // null = 출고 데이터 매칭 실패
  rate: number | null; // %, null = 계산 불가
  belowThreshold: boolean; // 출고량이 minShipped 미만 → 랭킹 제외 대상
}

export const computeRate = (
  exchanges: number,
  shipped: number | null | undefined,
  minShipped = 0,
): RateResult => {
  if (shipped == null || shipped <= 0) {
    return { exchanges, shipped: shipped ?? null, rate: null, belowThreshold: true };
  }
  return {
    exchanges,
    shipped,
    rate: (exchanges / shipped) * 100,
    belowThreshold: shipped < minShipped,
  };
};

// 교환율 색상 등급 (단위: %)
export interface RateBand {
  max: number;
  label: string;
  color: 'emerald' | 'amber' | 'orange' | 'rose';
}

export const RATE_BANDS: RateBand[] = [
  { max: 1, label: '양호', color: 'emerald' },
  { max: 2, label: '주의', color: 'amber' },
  { max: 4, label: '경고', color: 'orange' },
  { max: Infinity, label: '심각', color: 'rose' },
];

// 불량률은 훨씬 낮은 컷을 쓴다 (제품결함 ÷ 출고)
export const DEFECT_RATE_BANDS: RateBand[] = [
  { max: 0.3, label: '양호', color: 'emerald' },
  { max: 0.7, label: '주의', color: 'amber' },
  { max: 1.5, label: '경고', color: 'orange' },
  { max: Infinity, label: '심각', color: 'rose' },
];

export const rateBand = (rate: number, bands: RateBand[] = RATE_BANDS): RateBand =>
  bands.find((b) => rate < b.max) ?? bands[bands.length - 1];

export const MIN_SHIPPED_DEFAULT = 100;
export const MIN_SHIPPED_OPTIONS = [0, 50, 100, 300];

// ─────────────────────────────────────────────────────────────
// 출고량 조인 인덱스
// ─────────────────────────────────────────────────────────────

interface GroupQty {
  jasa: number;
  oebu: number;
  total: number;
}

const addQty = (map: Map<string, GroupQty>, key: string, group: ChannelGroup, qty: number) => {
  const cur = map.get(key) ?? { jasa: 0, oebu: 0, total: 0 };
  cur[group] += qty;
  cur.total += qty;
  map.set(key, cur);
};

export interface ShipmentIndex {
  /** exact 상품명 키 */
  productExact: Map<string, GroupQty>;
  /** loose 상품명 키 (버전/시즌 제거, 충돌 시 합산) */
  productLoose: Map<string, GroupQty>;
  /** `${loose명}|${color}|${size}` */
  option: Map<string, GroupQty>;
  /** BQ sales_channel → qty */
  channel: Map<string, number>;
  /** `${YYYY-MM}|${loose명}` */
  productMonth: Map<string, GroupQty>;
  /** category1 → qty */
  category: Map<string, GroupQty>;
  /** 기간 전체 합계 */
  total: GroupQty;
}

export const buildShipmentIndex = (data: ShipmentData): ShipmentIndex => {
  const idx: ShipmentIndex = {
    productExact: new Map(),
    productLoose: new Map(),
    option: new Map(),
    channel: new Map(),
    productMonth: new Map(),
    category: new Map(),
    total: { jasa: 0, oebu: 0, total: 0 },
  };

  for (const r of data.byProduct) {
    addQty(idx.productExact, normalizeExact(r.name), r.channelGroup, r.qty);
    addQty(idx.productLoose, normalizeLoose(r.name), r.channelGroup, r.qty);
    if (r.category1) addQty(idx.category, r.category1, r.channelGroup, r.qty);
    idx.total[r.channelGroup] += r.qty;
    idx.total.total += r.qty;
  }
  for (const r of data.byOption) {
    if (!r.color || !r.size) continue;
    const key = `${normalizeLoose(r.name)}|${r.color.trim()}|${normalizeSize(r.size)}`;
    addQty(idx.option, key, r.channelGroup, r.qty);
  }
  for (const r of data.byChannel) {
    idx.channel.set(r.salesChannel, (idx.channel.get(r.salesChannel) ?? 0) + r.qty);
  }
  for (const r of data.byProductMonth) {
    addQty(idx.productMonth, `${r.month}|${normalizeLoose(r.name)}`, r.channelGroup, r.qty);
  }
  return idx;
};

/** exact 우선, 실패 시 loose — 상품 레벨 출고량 조회 */
export const lookupProduct = (idx: ShipmentIndex, sheetName?: string): GroupQty | null =>
  idx.productExact.get(normalizeExact(sheetName)) ??
  idx.productLoose.get(normalizeLoose(sheetName)) ??
  null;

// 사이즈 별칭 통일 (시트 옵션 'S/M' ↔ BQ 'S-M' 등)
export const normalizeSize = (s?: string | null): string =>
  (s || '').trim().toUpperCase().replace('/', '-');

export const lookupOption = (
  idx: ShipmentIndex,
  sheetName?: string,
  color?: string,
  size?: string,
): GroupQty | null =>
  idx.option.get(`${normalizeLoose(sheetName)}|${(color || '').trim()}|${normalizeSize(size)}`) ??
  null;

export const lookupChannel = (idx: ShipmentIndex, sheetChannel?: string): number | null =>
  idx.channel.get(mapSheetChannelToBQ(sheetChannel)) ?? null;

// ─────────────────────────────────────────────────────────────
// 매칭 커버리지 — 매칭 실패를 숨기지 않고 노출하기 위한 집계
// ─────────────────────────────────────────────────────────────

export interface MatchCoverage {
  matched: number;
  unmatched: number;
  unmatchedNames: { name: string; count: number }[];
}

export const buildMatchCoverage = (
  exchangeRows: { 상품명?: string }[],
  idx: ShipmentIndex,
): MatchCoverage => {
  const counter = new Map<string, number>();
  let matched = 0;
  let unmatched = 0;
  for (const row of exchangeRows) {
    const name = (row['상품명'] || '').trim();
    if (!name) continue;
    if (lookupProduct(idx, name)) {
      matched++;
    } else {
      unmatched++;
      counter.set(name, (counter.get(name) ?? 0) + 1);
    }
  }
  const unmatchedNames = [...counter.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  return { matched, unmatched, unmatchedNames };
};
