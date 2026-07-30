export interface ExchangeHistoryDetail {
  range: { start: string; end: string };
  channelGroup: 'jasa' | 'oebu';
  totalCount: number;
  defectCount: number;
  topProducts: { name: string; cnt: number }[];
  reasonDistribution: { reason: string; cnt: number }[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 밴드초과 지점 클릭 시점에만 조회하는 온디맨드 API라 캐시는 짧게(같은 지점 재클릭 대비)만 둔다.
const cache = new Map<string, ExchangeHistoryDetail>();

export const fetchExchangeHistoryDetail = async (
  start: string,
  end: string,
  channelGroup: 'jasa' | 'oebu',
): Promise<ExchangeHistoryDetail> => {
  const key = `${start}|${end}|${channelGroup}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // Vercel 함수 12개 제한으로 exchange-history 함수에 ?resource=detail 로 합침
  const url = `${API_BASE_URL}/exchange-history?resource=detail&start=${start}&end=${end}&channelGroup=${channelGroup}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `조회 실패 (${response.status})`);
  }
  const data: ExchangeHistoryDetail = await response.json();
  cache.set(key, data);
  return data;
};
