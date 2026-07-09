// 반품입고시트(판토스_입고리스트) 완료 건 → 히스토리 시트 이관 스크립트
//
// 미처리함(판토스_입고리스트)에 완료된 반품 건이 계속 쌓이면 시트가 무거워져서
// (특히 예전 E열 거대 수식과 맞물려) API 응답이 느려지는 문제가 있었음
// (업데이트기록.md 2026-07-06 참고). 완료된 건은 주기적으로 히스토리 시트로
// 옮겨서 미처리함을 작게 유지한다.
//
// 자동 스케줄 없음 — 구글시트 양식이 바뀔 수 있어 당분간 수동 실행으로 운영.
//
// 판정 규칙:
//   - 같은 주문번호를 그룹으로 묶는다.
//   - 그룹 안 모든 행의 완료일에 날짜(YYYY-MM-DD)가 "포함"되어 있어야
//     이관 대상. ("(무료)2026-06-10" 처럼 접두어가 붙어도 인정)
//   - 하나라도 날짜가 없거나("확인필요", "고객확인중-이름", "교환" 등) 비어있으면
//     그룹 전체를 미처리함에 그대로 둔다 (부분완료로 인한 오배송 방지).
//   - 주문번호 자체가 "확인필요" 같은 placeholder라도 별도 처리 없음 —
//     완료일 기준으로만 판단 (2026-07-06 논의 결과).
//
// 주문번호/완료일 열 위치는 고정 문자가 아니라 헤더 텍스트로 매번 찾는다 —
// 2026-07-09, "수동구분" 열 삭제로 이후 열이 밀려 조용히 잘못된 열을 읎던
// 사고 이후 도입. 또한 행을 그대로 복사하는 방식이라 반품입고시트와
// 히스토리시트의 열 구성이 완전히 같아야 하므로, 이관 전에 헤더가
// 일치하는지 검증하고 다르면 중단한다.
//
// 사용법:
//   node scripts/archive-completed.mjs           # 실제로 이관
//   node scripts/archive-completed.mjs --dry-run  # 몇 건이 이관될지만 확인
//
// 안전장치:
//   - 매 단계(쓰기 → 검증 → 삭제) 순서로 진행하며, 검증 실패 시 즉시 중단
//     (삭제는 절대 먼저 하지 않음)
//   - 실행 전 스프레드시트 전체를 수동으로 한 번 복사(파일 → 사본 만들기)
//     해두는 것을 권장 (구글 버전 기록도 있지만 이중 안전장치)

import { JWT } from 'google-auth-library';
import { createRequire } from 'module';
import { resolveColumns } from '../../api/_columns.js';

const RETURNS_SS_ID = '1B6UKmborJQCAKIrIBziAFMjKR0CfY8Jul1E_Rbs5C3Y';
const PENDING = '판토스_입고리스트';
const HISTORY = '판토스_입고_히스토리';
const DATE_RE = /\d{4}-\d{2}-\d{2}/;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TIMEOUT_MS = 25000;
const CHUNK = 5000;

function getJwt() {
  let creds;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else {
    const require = createRequire(import.meta.url);
    creds = require('../service-account.json');
  }
  return new JWT({ email: creds.client_email, key: creds.private_key, scopes: SCOPES });
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`응답 없음 (${TIMEOUT_MS / 1000}초 초과)`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(fn, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      console.log(`   (재시도 ${i + 1}/${tries}: ${err.message})`);
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function get(jwt, range) {
  return withRetry(async () => {
    const { token } = await jwt.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${RETURNS_SS_ID}/values/${encodeURIComponent(range)}`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets GET 오류');
    return data.values || [];
  });
}

async function put(jwt, range, values) {
  return withRetry(async () => {
    const { token } = await jwt.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${RETURNS_SS_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const res = await fetchWithTimeout(url, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, values }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets PUT 오류');
    return res.status;
  });
}

async function post(jwt, body) {
  return withRetry(async () => {
    const { token } = await jwt.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${RETURNS_SS_ID}:batchUpdate`;
    const res = await fetchWithTimeout(url, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'batchUpdate 오류');
    return { status: res.status, data };
  });
}

async function getSheetMeta(jwt) {
  return withRetry(async () => {
    const { token } = await jwt.getAccessToken();
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

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const jwt = getJwt();

  console.log('0) 헤더 확인 중 (반품입고시트 vs 히스토리시트 열 구성 일치 검증)...');
  const [pendingHeader, historyHeader] = await Promise.all([
    get(jwt, `'${PENDING}'!1:1`),
    get(jwt, `'${HISTORY}'!1:1`),
  ]);
  const cols = resolveColumns(pendingHeader[0], { orderNo: '주문번호', doneDate: '완료일' }, PENDING);
  const pendingH = (pendingHeader[0] || []).map(h => (h || '').toString().trim());
  const historyH = (historyHeader[0] || []).map(h => (h || '').toString().trim());
  if (JSON.stringify(pendingH) !== JSON.stringify(historyH)) {
    throw new Error(`${PENDING}와 ${HISTORY}의 헤더 열 구성이 다릅니다 — 행을 그대로 복사하면 데이터가 어긋납니다.\n  ${PENDING}: ${pendingH.join(', ')}\n  ${HISTORY}: ${historyH.join(', ')}`);
  }
  console.log('   헤더 일치 확인됨. 주문번호=' + (cols.orderNo + 1) + '번째 열, 완료일=' + (cols.doneDate + 1) + '번째 열');

  console.log('1) 미처리함 전체 읽기...');
  const rows = await get(jwt, `'${PENDING}'!A3:AC`);
  console.log('  ', rows.length, '행');

  const { archiveRows, totalGroups, partialGroups, partialRowCount } = findArchiveRows(rows, cols.orderNo, cols.doneDate);
  console.log(`2) 전체 그룹 ${totalGroups}개 / 이관 대상 ${archiveRows.length}행 / 부분완료 보류 ${partialGroups}그룹(${partialRowCount}행)`);

  if (archiveRows.length === 0) {
    console.log('이관할 게 없습니다. 종료.');
    return;
  }

  if (dryRun) {
    console.log('\n--dry-run 모드라 실제로 이관하지 않았습니다.');
    return;
  }

  console.log('3) 히스토리 그리드 크기 확인/확장...');
  const meta = await getSheetMeta(jwt);
  const historySheet = meta.find(s => s.properties.title === HISTORY);
  const pendingSheet = meta.find(s => s.properties.title === PENDING);
  const beforeHistory = await get(jwt, `'${HISTORY}'!A3:A`);
  const histNextRow = 3 + beforeHistory.length;
  const histNeeded = histNextRow - 1 + archiveRows.length + 100;
  if (historySheet.properties.gridProperties.rowCount < histNeeded) {
    await post(jwt, { requests: [{ updateSheetProperties: { properties: { sheetId: historySheet.properties.sheetId, gridProperties: { rowCount: histNeeded } }, fields: 'gridProperties.rowCount' } }] });
    console.log('   그리드 확장 완료');
  }

  console.log('4) 히스토리에 청크 쓰기...');
  for (let i = 0; i < archiveRows.length; i += CHUNK) {
    const chunk = archiveRows.slice(i, i + CHUNK).map(r => r.values);
    const startRow = histNextRow + i;
    const status = await put(jwt, `'${HISTORY}'!A${startRow}`, chunk);
    console.log(`   ${startRow}행부터 ${chunk.length}행: status=${status}`);
  }

  console.log('5) 쓰기 검증...');
  const histAfter = await get(jwt, `'${HISTORY}'!A3:A`);
  const expected = beforeHistory.length + archiveRows.length;
  console.log('   히스토리:', histAfter.length, '(기대:', expected, ')');
  if (histAfter.length !== expected) {
    console.log('⚠️ 불일치! 삭제하지 않고 중단합니다. 수동 확인 필요.');
    process.exit(1);
  }

  console.log('6) 미처리함에서 이관된 행 삭제...');
  const absRowsDesc = archiveRows.map(r => r.absRow).sort((a, b) => b - a);
  const ranges = [];
  let curStart = absRowsDesc[0], curEnd = absRowsDesc[0];
  for (let i = 1; i < absRowsDesc.length; i++) {
    if (absRowsDesc[i] === curEnd - 1) curEnd = absRowsDesc[i];
    else { ranges.push([curStart, curEnd]); curStart = curEnd = absRowsDesc[i]; }
  }
  ranges.push([curStart, curEnd]);
  const deleteRequests = ranges.map(([hi, lo]) => ({
    deleteDimension: { range: { sheetId: pendingSheet.properties.sheetId, dimension: 'ROWS', startIndex: lo - 1, endIndex: hi } }
  }));
  const delRes = await post(jwt, { requests: deleteRequests });
  console.log('   삭제 결과:', delRes.status);

  console.log('7) 최종 검증...');
  const finalPending = await get(jwt, `'${PENDING}'!A3:A`);
  const finalHistory = await get(jwt, `'${HISTORY}'!A3:A`);
  console.log('   미처리함:', finalPending.length, '/ 히스토리:', finalHistory.length);
}

main().catch(err => {
  console.error('실패:', err.message);
  process.exit(1);
});
