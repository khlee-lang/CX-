// 프로젝트 간트 API 클라이언트 (백엔드: dashboard-data?resource=gantt)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const URL_ = `${API_BASE_URL}/dashboard-data?resource=gantt`;

export const GANTT_STATUSES = ['done', 'active', 'blocked', 'external', 'queued'] as const;
export type GanttStatus = (typeof GANTT_STATUSES)[number];

export const GANTT_STATUS_LABELS: Record<GanttStatus, string> = {
  done: '완료',
  active: '진행중',
  blocked: '막힘',
  external: '외부 대기',
  queued: '대기',
};

export interface GanttTask {
  id: string;
  group: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD, 마일스톤은 ''
  status: GanttStatus;
  progress: number; // 0~100
  deps: string[];   // 선행 작업 ID 목록
  milestone: boolean;
  critical: boolean;
  note: string;
  order: number;
  updatedAt: string;
}

// upsert 시 보낼 수 있는 필드 (id 있으면 수정, 없으면 추가)
export type GanttTaskInput = Partial<Omit<GanttTask, 'updatedAt'>>;

export const fetchGanttTasks = async (): Promise<GanttTask[] | null> => {
  try {
    const res = await fetch(URL_);
    if (!res.ok) return null;
    const data = await res.json();
    return data.tasks ?? [];
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

export const upsertGanttTask = (task: GanttTaskInput, adminKey: string) =>
  post({ action: 'upsert', task, adminKey });

export const deleteGanttTask = (id: string, adminKey: string) =>
  post({ action: 'delete', id, adminKey });
