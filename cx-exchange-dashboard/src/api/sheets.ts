export interface ExchangeData {
  spreadsheetTitle: string;
  data: {
    jasaMall: any[];
    bulryang: any[];
    oebuMall: any[];
    inventory: any[];
  };
}

const API_BASE_URL = 'http://localhost:3001/api';

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
