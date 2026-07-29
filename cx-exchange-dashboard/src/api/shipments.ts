export type ChannelGroup = 'jasa' | 'oebu';

export interface ShipmentByDay {
  date: string; // YYYY-MM-DD
  channelGroup: ChannelGroup;
  qty: number;
}
export interface ShipmentByChannel {
  salesChannel: string;
  channelGroup: ChannelGroup;
  qty: number;
}
export interface ShipmentByProduct {
  name: string;
  category1: string | null;
  channelGroup: ChannelGroup;
  qty: number;
}
export interface ShipmentByProductMonth {
  month: string; // YYYY-MM
  name: string;
  channelGroup: ChannelGroup;
  qty: number;
}
export interface ShipmentByOption {
  name: string;
  color: string | null;
  size: string | null;
  channelGroup: ChannelGroup;
  qty: number;
}

export interface ShipmentData {
  range: { start: string; end: string };
  coverage: { minDate: string };
  fetchedAt: string;
  byDay: ShipmentByDay[];
  byChannel: ShipmentByChannel[];
  byProduct: ShipmentByProduct[];
  byProductMonth: ShipmentByProductMonth[];
  byOption: ShipmentByOption[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 일 단위 갱신 데이터라 시트(5분)보다 길게 캐시.
let cache: { ts: number; key: string; data: ShipmentData } | null = null;
let inflight: { key: string; promise: Promise<ShipmentData | null> } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

/**
 * 출고 데이터 조회. 실패 시 throw 하지 않고 null을 반환한다 —
 * 페이지는 출고/교환율 지표만 숨기고 교환 지표는 정상 렌더해야 한다(graceful degradation).
 */
export const fetchShipments = async (
  start?: string,
  end?: string,
  force = false,
): Promise<ShipmentData | null> => {
  const key = `${start || ''}~${end || ''}`;
  if (!force && cache && cache.key === key && Date.now() - cache.ts < CACHE_TTL) {
    return cache.data;
  }
  if (!force && inflight && inflight.key === key) return inflight.promise;

  const promise = (async (): Promise<ShipmentData | null> => {
    try {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const qs = params.toString();
      const response = await fetch(`${API_BASE_URL}/shipments${qs ? `?${qs}` : ''}`);
      if (!response.ok) {
        console.warn('[shipments] fetch failed:', response.status);
        return null;
      }
      const data: ShipmentData = await response.json();
      cache = { ts: Date.now(), key, data };
      return data;
    } catch (err) {
      console.warn('[shipments] fetch error:', err);
      return null;
    }
  })();

  inflight = { key, promise };
  try {
    return await promise;
  } finally {
    inflight = null;
  }
};
