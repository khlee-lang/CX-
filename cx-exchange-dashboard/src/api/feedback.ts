// 수정 요청 시스템 API 클라이언트 (백엔드: dashboard-data?resource=feedback)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const URL_ = `${API_BASE_URL}/dashboard-data?resource=feedback`;

export const FEEDBACK_STATUSES = ['요청중', '확인중', '수정중', '완료', '반려'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_TAGS = ['수정요청', '질문', '메모'] as const;
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];

export interface FeedbackRequest {
  id: string;
  createdAt: string;
  page: string;
  section: string;
  author: string;
  status: FeedbackStatus;
  updatedAt: string;
}

export interface FeedbackMessage {
  id: string;
  requestId: string;
  at: string;
  author: string;
  role: 'user' | 'admin' | 'system';
  tag: string;
  content: string;
}

export interface FeedbackData {
  requests: FeedbackRequest[];
  messages: FeedbackMessage[];
}

export const fetchFeedback = async (): Promise<FeedbackData | null> => {
  try {
    const res = await fetch(URL_);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const post = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; id?: string }> => {
  try {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `요청 실패 (${res.status})` };
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '네트워크 오류' };
  }
};

export const createFeedbackRequest = (p: {
  page: string; section: string; author: string; content: string; adminKey?: string;
}) => post({ action: 'create', ...p });

export const sendFeedbackMessage = (p: {
  requestId: string; author: string; content: string; tag: FeedbackTag; adminKey?: string;
}) => post({ action: 'message', ...p });

export const changeFeedbackStatus = (p: { requestId: string; status: FeedbackStatus; adminKey: string }) =>
  post({ action: 'status', ...p });

// 서버가 {ok: 키일치여부}를 200으로 주고, post()의 스프레드가 data.ok로 덮어쓰므로 그대로 신뢰 가능
export const verifyAdminKey = async (adminKey: string): Promise<boolean> =>
  (await post({ action: 'verify', adminKey })).ok === true;
