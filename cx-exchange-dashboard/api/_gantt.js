// 프로젝트 간트 차트 백엔드
//
// 저장소: 교환 구글시트의 숨김 워크시트 '프로젝트간트' (작업 1건 = 1행)
// Vercel 함수 12개 제한 → 별도 함수 파일 없이 dashboard-data.js?resource=gantt
// 로 라우팅된다 (_feedback.js와 동일 패턴).
//
// 관리자 모드: 쓰기(upsert/delete/bulkUpsert)는 FEEDBACK_ADMIN_KEY와 일치하는
// 키를 보낸 요청만 허용. 조회(GET)는 페이지 쪽에서 관리자 게이트로 막지만
// 데이터 자체에 개인정보가 없어 서버는 열어둔다.
import { createDoc } from './_sheets.js';

const SHEET_TITLE = '프로젝트간트';
const HEADERS = [
  'ID', '그룹', '이름', '시작일', '종료일', '상태', '진행률',
  '의존', '마일스톤', '크리티컬', '메모', '정렬', '최종수정일시',
];
export const GANTT_STATUSES = ['done', 'active', 'blocked', 'external', 'queued'];

const ADMIN_KEY = process.env.FEEDBACK_ADMIN_KEY || 'deepdive1!';
const isAdmin = (key) => typeof key === 'string' && key.length > 0 && key === ADMIN_KEY;

const nowKst = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 16).replace('T', ' ');
};

const newId = () => `T-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const isIsoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

async function getOrCreateSheet(doc) {
  let sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) {
    sheet = await doc.addSheet({ title: SHEET_TITLE, headerValues: HEADERS, hidden: true });
    return sheet;
  }
  await sheet.loadHeaderRow().catch(async () => {
    await sheet.setHeaderRow(HEADERS);
  });
  return sheet;
}

const rowToTask = (row) => ({
  id: row.get('ID') || '',
  group: row.get('그룹') || '',
  name: row.get('이름') || '',
  start: row.get('시작일') || '',
  end: row.get('종료일') || '',
  status: row.get('상태') || 'queued',
  progress: Number(row.get('진행률') || 0),
  deps: (row.get('의존') || '').split(',').map((s) => s.trim()).filter(Boolean),
  milestone: row.get('마일스톤') === 'Y',
  critical: row.get('크리티컬') === 'Y',
  note: row.get('메모') || '',
  order: Number(row.get('정렬') || 0),
  updatedAt: row.get('최종수정일시') || '',
});

// task(JS 객체) → 시트 행 값. undefined 필드는 건드리지 않도록 호출부에서 걸러 보낸다.
const taskToRowValues = (t) => ({
  ...(t.group !== undefined && { 그룹: t.group }),
  ...(t.name !== undefined && { 이름: t.name }),
  ...(t.start !== undefined && { 시작일: t.start }),
  ...(t.end !== undefined && { 종료일: t.end }),
  ...(t.status !== undefined && { 상태: t.status }),
  ...(t.progress !== undefined && { 진행률: String(t.progress ?? 0) }),
  ...(t.deps !== undefined && { 의존: (t.deps || []).join(',') }),
  ...(t.milestone !== undefined && { 마일스톤: t.milestone ? 'Y' : '' }),
  ...(t.critical !== undefined && { 크리티컬: t.critical ? 'Y' : '' }),
  ...(t.note !== undefined && { 메모: t.note }),
  ...(t.order !== undefined && { 정렬: String(t.order ?? 0) }),
});

function validateTask(t, { partial = false } = {}) {
  if (!partial || t.name !== undefined) {
    if (!t.name?.trim()) return '이름은 필수입니다.';
  }
  if (!partial || t.start !== undefined) {
    if (!isIsoDate(t.start)) return '시작일은 YYYY-MM-DD 형식이어야 합니다.';
  }
  // 마일스톤은 종료일 없이 시작일 하나만 갖는다
  if (t.end !== undefined && t.end !== '' && !isIsoDate(t.end)) return '종료일은 YYYY-MM-DD 형식이어야 합니다.';
  if (t.status !== undefined && !GANTT_STATUSES.includes(t.status)) {
    return `상태는 ${GANTT_STATUSES.join('/')} 중 하나여야 합니다.`;
  }
  if (t.progress !== undefined) {
    const p = Number(t.progress);
    if (!Number.isFinite(p) || p < 0 || p > 100) return '진행률은 0~100 사이 숫자여야 합니다.';
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const doc = createDoc();
    await doc.loadInfo();
    const sheet = await getOrCreateSheet(doc);

    if (req.method === 'GET') {
      const rows = await sheet.getRows();
      const tasks = rows.map(rowToTask).filter((t) => t.id)
        .sort((a, b) => a.order - b.order);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ tasks, fetchedAt: new Date().toISOString() });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = req.body || {};
    const action = body.action;
    const admin = isAdmin(body.adminKey);

    if (action === 'verify') {
      return res.json({ ok: admin });
    }

    if (!admin) return res.status(403).json({ error: '간트 편집은 관리자만 가능합니다.' });

    if (action === 'upsert') {
      const t = body.task || {};
      const rows = await sheet.getRows();
      const existing = t.id ? rows.find((r) => r.get('ID') === t.id) : null;
      const err = validateTask(t, { partial: !!existing });
      if (err) return res.status(400).json({ error: err });
      const at = nowKst();

      if (existing) {
        const values = taskToRowValues(t);
        Object.entries(values).forEach(([k, v]) => existing.set(k, v));
        existing.set('최종수정일시', at);
        await existing.save();
        return res.json({ ok: true, id: t.id });
      }

      const id = t.id || newId();
      // 정렬값 미지정이면 맨 뒤로
      const maxOrder = rows.reduce((m, r) => Math.max(m, Number(r.get('정렬') || 0)), 0);
      await sheet.addRow({
        ID: id,
        그룹: t.group || '',
        이름: t.name.trim(),
        시작일: t.start,
        종료일: t.end || '',
        상태: t.status || 'queued',
        진행률: String(t.progress ?? 0),
        의존: (t.deps || []).join(','),
        마일스톤: t.milestone ? 'Y' : '',
        크리티컬: t.critical ? 'Y' : '',
        메모: t.note || '',
        정렬: String(t.order ?? maxOrder + 10),
        최종수정일시: at,
      });
      return res.json({ ok: true, id });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'ID가 필요합니다.' });
      const rows = await sheet.getRows();
      const row = rows.find((r) => r.get('ID') === id);
      if (!row) return res.status(404).json({ error: '해당 작업을 찾을 수 없습니다.' });
      await row.delete();
      return res.json({ ok: true });
    }

    if (action === 'bulkUpsert') {
      // 초기 시딩/일괄 반영용. tasks 배열 전체를 검증 후 순서대로 추가한다.
      const tasks = Array.isArray(body.tasks) ? body.tasks : [];
      if (!tasks.length) return res.status(400).json({ error: 'tasks 배열이 비어 있습니다.' });
      for (const t of tasks) {
        const err = validateTask(t);
        if (err) return res.status(400).json({ error: `${t.name || t.id || '?'}: ${err}` });
      }
      const at = nowKst();
      const rows = tasks.map((t, i) => ({
        ID: t.id || newId(),
        그룹: t.group || '',
        이름: t.name.trim(),
        시작일: t.start,
        종료일: t.end || '',
        상태: t.status || 'queued',
        진행률: String(t.progress ?? 0),
        의존: (t.deps || []).join(','),
        마일스톤: t.milestone ? 'Y' : '',
        크리티컬: t.critical ? 'Y' : '',
        메모: t.note || '',
        정렬: String(t.order ?? (i + 1) * 10),
        최종수정일시: at,
      }));
      await sheet.addRows(rows);
      return res.json({ ok: true, count: rows.length });
    }

    return res.status(400).json({ error: `알 수 없는 action: ${action}` });
  } catch (err) {
    console.error('[gantt] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
