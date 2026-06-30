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

export const fetchDashboardData = async (): Promise<ExchangeData> => {
  const response = await fetch(`${API_BASE_URL}/dashboard-data`);
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }
  return response.json();
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
