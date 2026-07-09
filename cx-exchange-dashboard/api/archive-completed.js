// 반품입고시트(판토스_입고리스트) 완료 건 → 히스토리 시트 이관 API
//
// 미처리함(판토스_입고리스트)에 완료된 반품 건이 계속 쌓이면 시트가 무거워져서
// API 응답이 느려지는 문제가 있었음 (업데이트기록.md 2026-07-06 참고).
// 완료된 건은 주기적으로 히스토리 시트로 옮겨서 미처리함을 작게 유지한다.
//
// 판정 규칙:
//   - 같은 주문번호를 그룹으로 묶는다.
//   - 그룹 안 모든 행의 완료일에 날짜(YYYY-MM-DD)가 "포함"되어 있어야
//     이관 대상. ("(무료)2026-06-10" 처럼 접두어가 붙어도 인정)
//   - 하나라도 날짜가 없거나("확인필요", "고객확인중-이름", "교환" 등) 비어있으면
//     그룹 전체를 미처리함에 그대로 둔다 (부분완료로 인한 오배송 방지).
//
// 주문번호/완료일 열 위치는 고정 문자가 아니라 헤더 텍스트로 매번 찾는다 —
// 2026-07-09, "수동구분" 열 삭제로 이후 열이 밀려 조용히 잘못된 열을 읎던
// 사고 이후 도입. 또한 행을 그대로 복사하는 방식이라 반품입고시트와
// 히스토리시트의 열 구성이 완전히 같아야 하므로, 이관 전에 헤더가
// 일치하는지 검증하고 다르면 중단한다.
//
// POST { apply: false } → 미리보기(몇 건이 이관될지만 계산)
// POST { apply: true }  → 실제로 이관 (쓰기 검증 성공 후에만 삭제)

import { JWT } from 'google-auth-library';
import { createRequire } from 'module';
import { resolveColumns } from './_columns.js';

const RETURNS_SS_ID = '1B6UKmborJQCAKIrIBziAFMjKR0CfY8Jul1E_Rbs5C3Y';
const PENDING = '판토스_입고리스트';
const HISTORY = '판토스_입고_히스토리';
const DATE_RE = /\d{4}-\d{2}-\d{2}/;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const FETCH_TIMEOUT_MS = 20000;
const CHUNK = 5000;

function getJwt() {
  let creds;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else {
    const require = createRequire(import.meta.url);
    creds = require('../server/service-account.json');
  }
  return new JWT({ email: creds.client_email, key: creds.private_key, scopes: SCOPES });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getAccessTokenWithTimeout(jwt) {
  return Promise.race([
    jwt.getAccessToken(),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`토큰 발급 응답 없음 (${FETCH_TIMEOUT_MS / 1000}초 초과)`)), FETCH_TIMEOUT_MS)),
  ]);
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Sheets API 응답 없음 (${FETCH_TIMEOUT_MS / 1000}초 초과)`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(fn, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const transient = /unavailable|internal error|rate limit|timeout|응답 없음/i.test(err.message || '');
      if (!transient || i === tries - 1) throw err;
      await sleep(1000 * (i + 1));
    }
  }
  throw lastErr;
}

async function sheetsGet(jwt, range) {
  return withRetry(async () => {
    const { token } = await getAccessTokenWithTimeout(jwt);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${RETURNS_SS_ID}/values/${encodeURIComponent(range)}`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets GET 오류');
    return data.values || [];
  });
}

async function sheetsPut(jwt, range, values) {
  return withRetry(async () => {
    const { token } = await getAccessTokenWithTimeout(jwt);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${RETURNS_SS_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const res = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, values }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets PUT 오류');
    return res.status;
  });
}

async function sheetsBatchUpdate(jwt, body) {
  return withRetry(async () => {
    const { token } = await getAccessTokenWithTimeout(jwt);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${RETURNS_SS_ID}:batchUpdate`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'batchUpdate 오류');
    return data;
  });
}

async function getSheetMeta(jwt) {
  return withRetry(async () => {
    const { token } = await getAccessTokenWithTimeout(jwt);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${RETURNS_SS_ID}?fields=sheets.properties(title,sheetId,gridProperties)`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
    return (await res.json()).sheets;
  });
}

function findArchiveRows(rows, orderNoIdx, doneDateIdx) {
  const groups = {};
  rows.forEach((row, i) => {
    const orderNo = (row[orderNoIdx] || '').toString().trim();
    if (!orderNo) return;
    if (!groups[orderNo]) groups[orderNo] = [];
    groups[orderNo].push({ absRow: 3 + i, values: row });
  });

  const archiveRows = [];
  let partialGroups = 0, partialRowCount = 0;
  for (const members of Object.values(groups)) {
    const allDone = members.every(m => DATE_RE.test((m.values[doneDateIdx] || '').toString().trim()));
    if (allDone) archiveRows.push(...members);
    else if (members.some(m => (m.values[doneDateIdx] || '').toString().trim())) {
      partialGroups++;
      partialRowCount += members.length;
    }
  }
  archiveRows.sort((a, b) => a.absRow - b.absRow);
  return { archiveRows, totalGroups: Object.keys(groups).length, partialGroups, partialRowCount };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apply = false } = req.body || {};

  try {
    const jwt = getJwt();

    // 주문번호/완료일 열 위치를 헤더에서 찾고, 히스토리시트 헤더와 완전히
    // 같은지 검증 (다르면 행을 그대로 복사할 때 열이 어긋나므로 중단)
    const [pendingHeader, historyHeader] = await Promise.all([
      sheetsGet(jwt, `'${PENDING}'!1:1`),
      sheetsGet(jwt, `'${HISTORY}'!1:1`),
    ]);
    const cols = resolveColumns(pendingHeader[0], { orderNo: '주문번호', doneDate: '완료일' }, PENDING);
    const pendingH = (pendingHeader[0] || []).map(h => (h || '').toString().trim());
    const historyH = (historyHeader[0] || []).map(h => (h || '').toString().trim());
    if (JSON.stringify(pendingH) !== JSON.stringify(historyH)) {
      throw new Error(`${PENDING}와 ${HISTORY}의 헤더 열 구성이 다릅니다 — 행을 그대로 복사하면 데이터가 어긋납니다. (${PENDING}: ${pendingH.join(', ')} / ${HISTORY}: ${historyH.join(', ')})`);
    }

    const rows = await sheetsGet(jwt, `'${PENDING}'!A3:AC`);
    const { archiveRows, totalGroups, partialGroups, partialRowCount } = findArchiveRows(rows, cols.orderNo, cols.doneDate);

    if (!apply || archiveRows.length === 0) {
      return res.json({
        totalGroups, archiveCount: archiveRows.length, partialGroups, partialRowCount, applied: false,
      });
    }

    const meta = await getSheetMeta(jwt);
    const historySheet = meta.find(s => s.properties.title === HISTORY);
    const pendingSheet = meta.find(s => s.properties.title === PENDING);
    const beforeHistory = await sheetsGet(jwt, `'${HISTORY}'!A3:A`);
    const histNextRow = 3 + beforeHistory.length;
    const histNeeded = histNextRow - 1 + archiveRows.length + 100;
    if (historySheet.properties.gridProperties.rowCount < histNeeded) {
      await sheetsBatchUpdate(jwt, {
        requests: [{ updateSheetProperties: { properties: { sheetId: historySheet.properties.sheetId, gridProperties: { rowCount: histNeeded } }, fields: 'gridProperties.rowCount' } }],
      });
    }

    for (let i = 0; i < archiveRows.length; i += CHUNK) {
      const chunk = archiveRows.slice(i, i + CHUNK).map(r => r.values);
      const startRow = histNextRow + i;
      await sheetsPut(jwt, `'${HISTORY}'!A${startRow}`, chunk);
    }

    const histAfter = await sheetsGet(jwt, `'${HISTORY}'!A3:A`);
    const expected = beforeHistory.length + archiveRows.length;
    if (histAfter.length !== expected) {
      throw new Error(`히스토리 쓰기 검증 실패 (기대 ${expected}, 실제 ${histAfter.length}) — 삭제하지 않고 중단`);
    }

    const absRowsDesc = archiveRows.map(r => r.absRow).sort((a, b) => b - a);
    const ranges = [];
    let curStart = absRowsDesc[0], curEnd = absRowsDesc[0];
    for (let i = 1; i < absRowsDesc.length; i++) {
      if (absRowsDesc[i] === curEnd - 1) curEnd = absRowsDesc[i];
      else { ranges.push([curStart, curEnd]); curStart = curEnd = absRowsDesc[i]; }
    }
    ranges.push([curStart, curEnd]);
    const deleteRequests = ranges.map(([hi, lo]) => ({
      deleteDimension: { range: { sheetId: pendingSheet.properties.sheetId, dimension: 'ROWS', startIndex: lo - 1, endIndex: hi } },
    }));
    await sheetsBatchUpdate(jwt, { requests: deleteRequests });

    const finalPending = await sheetsGet(jwt, `'${PENDING}'!A3:A`);
    const finalHistory = await sheetsGet(jwt, `'${HISTORY}'!A3:A`);

    res.json({
      totalGroups, archiveCount: archiveRows.length, partialGroups, partialRowCount, applied: true,
      pendingRemaining: finalPending.length, historyTotal: finalHistory.length,
    });
  } catch (err) {
    console.error('[archive-completed]', err);
    res.status(500).json({ error: err.message });
  }
}
