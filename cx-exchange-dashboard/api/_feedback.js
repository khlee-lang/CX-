// 세일즈 뷰 "수정 요청" 시스템 백엔드
//
// 저장소: 교환 구글시트의 숨김 워크시트 2개 (사람이 직접 열어볼 필요 없는 데이터 통)
//   - 수정요청:        요청(대화방) 1건 = 1행
//   - 수정요청_메시지:  메시지 1건 = 1행 (역할: user/admin/system)
//
// Vercel 함수 12개 제한 → 별도 함수 파일 없이 dashboard-data.js?resource=feedback
// 로 라우팅된다 (exchange-history.js의 ?resource= 분기와 동일한 패턴).
//
// 관리자 모드: 상태 변경은 FEEDBACK_ADMIN_KEY와 일치하는 키를 보낸 요청만 허용.
// 메시지 작성은 누구나 가능하되, 유효한 키와 함께 보내면 역할이 admin으로 기록되어
// 화면에 "관리자" 배지가 붙는다.
import { createDoc } from './_sheets.js';

const REQUESTS_SHEET = '수정요청';
const MESSAGES_SHEET = '수정요청_메시지';
const REQUEST_HEADERS = ['ID', '생성일시', '페이지', '섹션', '요청자', '상태', '최종수정일시'];
const MESSAGE_HEADERS = ['메시지ID', '요청ID', '일시', '작성자', '역할', '말머리', '내용'];
const STATUSES = ['요청중', '확인중', '수정중', '완료', '반려'];
const MAX_CONTENT_LEN = 2000;

const ADMIN_KEY = process.env.FEEDBACK_ADMIN_KEY || 'deepdive1!';
const isAdmin = (key) => typeof key === 'string' && key.length > 0 && key === ADMIN_KEY;

// KST "YYYY-MM-DD HH:mm"
const nowKst = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 16).replace('T', ' ');
};

const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function getOrCreateSheet(doc, title, headerValues) {
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    // hidden: 시트는 데이터 통일 뿐이라 시트 화면에서 탭이 안 보이게 숨긴다
    sheet = await doc.addSheet({ title, headerValues, hidden: true });
    return sheet;
  }
  await sheet.loadHeaderRow().catch(async () => {
    // 헤더가 아예 비어있는 시트면 채워준다
    await sheet.setHeaderRow(headerValues);
  });
  return sheet;
}

const rowsToObjects = (sheet, rows) =>
  rows.map((row) => {
    const o = {};
    sheet.headerValues.forEach((h) => { o[h] = row.get(h) ?? ''; });
    return o;
  });

export default async function handler(req, res) {
  try {
    const doc = createDoc();
    await doc.loadInfo();
    const reqSheet = await getOrCreateSheet(doc, REQUESTS_SHEET, REQUEST_HEADERS);
    const msgSheet = await getOrCreateSheet(doc, MESSAGES_SHEET, MESSAGE_HEADERS);

    if (req.method === 'GET') {
      const [reqRows, msgRows] = await Promise.all([reqSheet.getRows(), msgSheet.getRows()]);
      const requests = rowsToObjects(reqSheet, reqRows).map((r) => ({
        id: r['ID'], createdAt: r['생성일시'], page: r['페이지'], section: r['섹션'],
        author: r['요청자'], status: r['상태'], updatedAt: r['최종수정일시'],
      })).filter((r) => r.id);
      const messages = rowsToObjects(msgSheet, msgRows).map((m) => ({
        id: m['메시지ID'], requestId: m['요청ID'], at: m['일시'],
        author: m['작성자'], role: m['역할'], tag: m['말머리'], content: m['내용'],
      })).filter((m) => m.id);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ requests, messages, fetchedAt: new Date().toISOString() });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = req.body || {};
    const action = body.action;
    const admin = isAdmin(body.adminKey);

    if (action === 'verify') {
      return res.json({ ok: admin });
    }

    if (action === 'create') {
      const { page, section, author, content } = body;
      if (!section || !author?.trim() || !content?.trim()) {
        return res.status(400).json({ error: '섹션/요청자/내용은 필수입니다.' });
      }
      if (content.length > MAX_CONTENT_LEN) return res.status(400).json({ error: '내용이 너무 깁니다(2,000자 제한).' });
      const id = newId('REQ');
      const at = nowKst();
      await reqSheet.addRow({
        ID: id, 생성일시: at, 페이지: page || '/sales', 섹션: section,
        요청자: author.trim(), 상태: '요청중', 최종수정일시: at,
      });
      await msgSheet.addRow({
        메시지ID: newId('MSG'), 요청ID: id, 일시: at, 작성자: author.trim(),
        역할: admin ? 'admin' : 'user', 말머리: body.tag || '수정요청', 내용: content.trim(),
      });
      return res.json({ ok: true, id });
    }

    if (action === 'message') {
      const { requestId, author, content } = body;
      if (!requestId || !author?.trim() || !content?.trim()) {
        return res.status(400).json({ error: '요청ID/작성자/내용은 필수입니다.' });
      }
      if (content.length > MAX_CONTENT_LEN) return res.status(400).json({ error: '내용이 너무 깁니다(2,000자 제한).' });
      const at = nowKst();
      await msgSheet.addRow({
        메시지ID: newId('MSG'), 요청ID: requestId, 일시: at, 작성자: author.trim(),
        역할: admin ? 'admin' : 'user', 말머리: body.tag || '메모', 내용: content.trim(),
      });
      await touchRequest(reqSheet, requestId, at);
      return res.json({ ok: true });
    }

    if (action === 'status') {
      const { requestId, status } = body;
      if (!admin) return res.status(403).json({ error: '상태 변경은 관리자만 가능합니다.' });
      if (!requestId || !STATUSES.includes(status)) {
        return res.status(400).json({ error: `상태는 ${STATUSES.join('/')} 중 하나여야 합니다.` });
      }
      const at = nowKst();
      const rows = await reqSheet.getRows();
      const row = rows.find((r) => r.get('ID') === requestId);
      if (!row) return res.status(404).json({ error: '해당 요청을 찾을 수 없습니다.' });
      const prev = row.get('상태');
      if (prev === status) return res.json({ ok: true, unchanged: true });
      row.set('상태', status);
      row.set('최종수정일시', at);
      await row.save();
      // 리터니즈 스타일 시스템 메시지 — 상태 이력이 대화 흐름에 남는다
      await msgSheet.addRow({
        메시지ID: newId('MSG'), 요청ID: requestId, 일시: at, 작성자: '관리자',
        역할: 'system', 말머리: '상태변경', 내용: `상태가 '${prev}' → '${status}'(으)로 변경되었습니다.`,
      });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: `알 수 없는 action: ${action}` });
  } catch (err) {
    console.error('[feedback] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function touchRequest(reqSheet, requestId, at) {
  const rows = await reqSheet.getRows();
  const row = rows.find((r) => r.get('ID') === requestId);
  if (row) {
    row.set('최종수정일시', at);
    await row.save();
  }
}
