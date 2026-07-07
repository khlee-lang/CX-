export interface ExchangeData {
  spreadsheetTitle: string;
  data: {
    jasaMall: any[];
    bulryang: any[];
    oebuMall: any[];
    inventory: any[];
  };
}

// 로컬: Vite proxy가 /api → localhost:3001 으로 포워딩
// 배포(Vercel): 같은 도메인의 /api 서버리스 함수로 바로 연결
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 페이지(탭) 이동마다 2만 행 이상을 다시 받지 않도록 메모리 캐시 (5분).
// 새로고침 버튼은 force=true로 캐시를 무시함.
let cache: { ts: number; data: ExchangeData } | null = null;
let inflight: Promise<ExchangeData> | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export const fetchDashboardData = async (force = false): Promise<ExchangeData> => {
  if (!force && cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard-data`);
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard data');
    }
    const data = await response.json();
    cache = { ts: Date.now(), data };
    return data;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
};

export interface UpdateCellPayload {
  sheetTitle: string;
  rowIndex: number;
  column: string;
  value: string;
}

export const updateCell = async (payload: UpdateCellPayload): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/update-cell`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to update cell');
  }
};

export interface SendAlimtalkPayload {
  rowIndex: number;
  sheetTitle?: string;
  row: Record<string, any>;
}

export interface SendAlimtalkResult {
  success: boolean;
  sentDate: string;
  templateId: string;
}

export const sendAlimtalk = async (payload: SendAlimtalkPayload): Promise<SendAlimtalkResult> => {
  const response = await fetch(`${API_BASE_URL}/send-alimtalk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to send alimtalk');
  }
  return response.json();
};
