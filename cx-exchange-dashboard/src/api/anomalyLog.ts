import type { Granularity, ChannelGroup } from '../lib/controlChart';

export interface AnomalyEvent {
  event_id: string;
  detected_at: string;
  bucket_start: string;
  bucket_end: string;
  granularity: Granularity;
  channelGroup: ChannelGroup;
  rate: number | null;
  bandMean: number | null;
  bandUpper: number | null;
  bandLower: number | null;
  memo: string;
}

export interface CreateAnomalyEventInput {
  bucketStart: string;
  bucketEnd: string;
  granularity: Granularity;
  channelGroup: ChannelGroup;
  rate: number | null;
  bandMean: number | null;
  bandUpper: number | null;
  bandLower: number | null;
  memo: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const fetchAnomalyEvents = async (limit = 20): Promise<AnomalyEvent[]> => {
  // Vercel 함수 12개 제한으로 exchange-history 함수에 ?resource=anomaly 로 합침
  const response = await fetch(`${API_BASE_URL}/exchange-history?resource=anomaly&limit=${limit}`);
  if (!response.ok) throw new Error(`이상 이벤트 조회 실패 (${response.status})`);
  const data = await response.json();
  return data.events;
};

export const createAnomalyEvent = async (input: CreateAnomalyEventInput): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/exchange-history?resource=anomaly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `기록 실패 (${response.status})`);
  }
  const data = await response.json();
  return data.eventId;
};
