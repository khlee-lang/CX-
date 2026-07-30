export interface ExchangeHistoryDay {
  date: string;
  channelGroup: 'jasa' | 'oebu';
  exchangeCnt: number;
  defectCnt: number;
}

export interface ExchangeHistoryData {
  range: { start: string; end: string };
  coverage: { minDate: string; maxDate: string };
  fetchedAt: string;
  byDay: ExchangeHistoryDay[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 고정된 과거 데이터라 캐시를 길게(1시간) 두고, 실패 시 null 반환(graceful degradation).
let cache: { ts: number; data: ExchangeHistoryData } | null = null;
let inflight: Promise<ExchangeHistoryData | null> | null = null;
const CACHE_TTL = 60 * 60 * 1000;

export const fetchExchangeHistory = async (): Promise<ExchangeHistoryData | null> => {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  if (inflight) return inflight;

  inflight = (async (): Promise<ExchangeHistoryData | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/exchange-history`);
      if (!response.ok) {
        console.warn('[exchangeHistory] fetch failed:', response.status);
        return null;
      }
      const data: ExchangeHistoryData = await response.json();
      cache = { ts: Date.now(), data };
      return data;
    } catch (err) {
      console.warn('[exchangeHistory] fetch error:', err);
      return null;
    }
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
};
