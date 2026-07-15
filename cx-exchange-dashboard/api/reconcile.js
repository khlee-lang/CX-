import { JWT } from 'google-auth-library';
import { createRequire } from 'module';
import { resolveColumns } from './_columns.js';

const RETURNS_SS_ID  = '1B6UKmborJQCAKIrIBziAFMjKR0CfY8Jul1E_Rbs5C3Y';
const EXCHANGE_SS_ID = '1cqLifjcihpHlAUN9ZcG19uJ9MhdkYcOxLzMDPcaBufg';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// ── 인증 ──────────────────────────────────────────────────────────
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

// ── Sheets REST API ───────────────────────────────────────────────
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const FETCH_TIMEOUT_MS = 20000;

// jwt.getAccessToken()도 내부적으로 네트워크 호출이라 응답이 멈출 수 있음 → 타임아웃 적용
async function getAccessTokenWithTimeout(jwt) {
  return Promise.race([
    jwt.getAccessToken(),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`토큰 발급 응답 없음 (${FETCH_TIMEOUT_MS / 1000}초 초과)`)), FETCH_TIMEOUT_MS)),
  ]);
}

// 구글 서버가 응답 없이 멈춰버리는 경우, 무한 대기하지 않고 일정 시간 후 강제 실패 처리
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

// 구글 API가 가끔 주는 일시적 오류(503 등)나 무응답은 잠깐 기다렸다 재시도
async function withRetry(fn, tries = 3) {
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

async function sheetsGet(jwt, ssId, range) {
  return withRetry(async () => {
    const { token } = await getAccessTokenWithTimeout(jwt);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values/${encodeURIComponent(range)}`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets GET 오류');
    return data.values || [];
  });
}

async function sheetsBatchUpdate(jwt, ssId, updates) {
  return withRetry(async () => {
    const { token } = await getAccessTokenWithTimeout(jwt);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values:batchUpdate`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updates }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets batchUpdate 오류');
    return data;
  });
}

// ── 유틸 ─────────────────────────────────────────────────────────
function rowColToA1(row, col) {
  let colStr = '';
  let c = col;
  while (c > 0) {
    colStr = String.fromCharCode(64 + (c % 26 || 26)) + colStr;
    c = Math.floor((c - 1) / 26);
  }
  return `${colStr}${row}`;
}

function nextShippingDate(today) {
  const d = new Date(today);
  d.setDate(d.getDate() + 1);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  else if (day === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function arrivalTag(today) {
  const d = new Date(today);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `입고${mm}${dd}`;
}

function safeGet(row, idx) {
  return (row?.[idx] ?? '').toString().trim();
}

// 반품입고시트/교환접수시트에서 찾아야 하는 헤더 이름
// (열 위치는 헤더 텍스트로 매번 다시 찾음 — 시트 구조가 바뀌어도 안전하도록.
// 2026-07-09: "수동구분" 열 삭제로 이후 열이 통째로 밀려 조용히 오작동한 사고 이후 도입)
const RETURNS_HEADER_SPEC = {
  doneDate: '완료일',
  category: '구분',
  orderNo: '주문번호',
  item: '상품명/옵션명',
  qty: '수량',
  realQty: '실수량',
};
const EXCHANGE_HEADER_SPEC = {
  shipDate: '출고일',
  payMethod: '지불방법',
  orderNo: '주문번호',
  prevOpt: '교환 전 옵션',
  itemName: '상품명',
  newOpt: '교환 출고 옵션',
  qty: '수량',
};

// 카테고리별 설정: 대상 교환접수시트 이름 + 유효한 지불방법 값
// 외부몰은 '결제'(이미 결제완료, 자사몰의 '입금확인'과 동일 취급)와
// '동봉확인'/'동봉요청'(배송비 결제완료로 취급)이 자사몰에 없는 값이라 추가함
const CATEGORY_CONFIGS = {
  자사몰교환: {
    exchangeSheet: '[자사몰] 교환',
    validPay: new Set(['', '무상', '입금확인', '무료교환', '차감']),
  },
  외부몰교환: {
    exchangeSheet: '[외부몰] 교환',
    validPay: new Set(['', '무상', '입금확인', '무료교환', '차감', '결제', '동봉확인', '동봉요청']),
  },
};

// ── 파싱 ─────────────────────────────────────────────────────────
// rowOffset: 시트에서 실제 읽기 시작한 행번호 (1-based)
// 카테고리로 미리 걸러내지 않고 전부 그룹에 담는다 (2026-07-10 변경) —
// 신청하지 않은 상품이 같이 반품되면 그 행의 구분값이 다르게 매겨지는데,
// 여기서 미리 걸러내면 그 사실 자체를 reconcile()이 알 수 없어서
// "정상 처리"로 잘못 통과시키는 사고가 있었음. 각 행에 구분값을 같이
// 담아서 reconcile() 쪽에서 카테고리 혼재 여부를 판단하게 한다.
// done(완료 처리된) 행도 그룹에 포함시킨다 — 신청한 상품만 먼저 들어와 처리가
// 끝난 뒤, 상관없는 반품 상품이 같은 주문번호로 나중에 들어오는 경우를 잡아내려면
// "이미 끝난 행"의 존재도 알아야 하기 때문 (2026-07-15: 이 케이스를 못 잡아서
// 조용히 넘어간 사고 이후 추가).
function parseReturns(rows, rowOffset, cols) {
  const groups = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const orderNo = safeGet(row, cols.orderNo);
    if (!orderNo) continue;
    const item = safeGet(row, cols.item);
    const qtyRaw = safeGet(row, cols.realQty) || safeGet(row, cols.qty);
    const qty = parseInt(qtyRaw) || 0;
    const rowCategory = safeGet(row, cols.category);
    const done = !!safeGet(row, cols.doneDate);
    if (!groups[orderNo]) groups[orderNo] = [];
    groups[orderNo].push({ row: rowOffset + i, item, qty, category: rowCategory, done });
  }
  return groups;
}

function parseExchanges(rows, rowOffset, cols) {
  const groups = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const orderNo = safeGet(row, cols.orderNo);
    if (!orderNo) continue;
    const itemKey = safeGet(row, cols.itemName) + safeGet(row, cols.prevOpt);
    const qty = parseInt(safeGet(row, cols.qty)) || 0;
    if (!groups[orderNo]) groups[orderNo] = [];
    groups[orderNo].push({
      row: rowOffset + i,
      itemKey,
      qty,
      pay: safeGet(row, cols.payMethod),
      newOpt: safeGet(row, cols.newOpt),
      existingShipDate: safeGet(row, cols.shipDate),
    });
  }
  return groups;
}

function counterEqual(retRows, excRows) {
  const cntR = {};
  const cntE = {};
  for (const r of retRows) cntR[r.item] = (cntR[r.item] || 0) + r.qty;
  for (const r of excRows) cntE[r.itemKey] = (cntE[r.itemKey] || 0) + r.qty;
  const kR = Object.keys(cntR).sort();
  const kE = Object.keys(cntE).sort();
  if (kR.length !== kE.length) return false;
  return kR.every((k, i) => k === kE[i] && cntR[k] === cntE[k]);
}

// ── 매칭 & 출고일 결정 ───────────────────────────────────────────
function reconcile(returnsGroups, exchangeGroups, today, validPay, category) {
  const actions = [];
  const issues  = [];

  for (const [orderNo, allRetRows] of Object.entries(returnsGroups)) {
    // 이번 실행 대상 카테고리와 관련 없는 주문(전부 다른 구분값)은 건너뜀
    if (!allRetRows.some(r => r.category === category)) continue;

    // 같은 주문번호인데 구분값이 여러 개 섞여 있으면(예: 자사몰교환 5개 +
    // 신청 안 한 반품 5개) 개수만 맞으면 통과시키던 예전 로직으로는 못
    // 잡아냈던 케이스 — 사람이 확인해야 하는 이슈로 분리한다.
    // 완료(done) 처리된 행도 함께 봐야 한다: 신청 상품만 먼저 들어와 처리가
    // 끝난 뒤 상관없는 반품 상품이 나중에 같은 주문번호로 들어오는 경우,
    // 그 시점엔 미처리 행만 보면 섞임이 안 보여 조용히 지나가기 때문.
    const categories = [...new Set(allRetRows.map(r => r.category))];
    if (categories.length > 1) {
      const alreadyDone = allRetRows.some(r => r.done);
      issues.push({
        order_no: orderNo,
        issue_type: '카테고리혼재',
        description: alreadyDone
          ? `이 주문번호는 이미 일부 처리 완료됐는데, 이후 구분값이 다른 반품 항목이 추가로 들어왔습니다(${categories.join(', ')}) — 신청하지 않은 상품이 나중에 같이 반품됐을 수 있습니다.`
          : `반품입고시트에 이 주문번호로 구분값이 여러 개 섞여 있습니다(${categories.join(', ')}) — 신청하지 않은 상품이 같이 반품됐을 수 있습니다.`,
        return_rows: allRetRows.map(r => r.row),
      });
      continue;
    }

    const retRows = allRetRows.filter(r => !r.done);
    if (retRows.length === 0) continue; // 이미 전부 처리 완료된 주문
    const excRows = exchangeGroups[orderNo];

    if (!excRows) {
      issues.push({ order_no: orderNo, issue_type: '주문없음', description: '교환접수시트에 해당 주문번호가 없습니다.', return_rows: retRows.map(r => r.row) });
      continue;
    }

    if (!counterEqual(retRows, excRows)) {
      issues.push({ order_no: orderNo, issue_type: '상품불일치', description: '반품입고와 교환접수의 상품/옵션/수량이 일치하지 않습니다.', return_rows: retRows.map(r => r.row), exchange_rows: excRows.map(r => r.row) });
      continue;
    }

    // 선교환: 교환접수시트 출고일이 이미 채워져 있으면 반품이 나중에 들어온 것 →
    // 출고일은 건드리지 않고, 반품입고시트 확인완료일만 기입
    const existingShipDate = excRows.find(r => r.existingShipDate)?.existingShipDate;
    if (existingShipDate) {
      actions.push({
        order_no: orderNo,
        exchange_rows: excRows.map(r => r.row),
        return_rows: retRows.map(r => r.row),
        ship_date: `이미출고됨(${existingShipDate})`,
        done_date: today,
        reason: `${existingShipDate} 선출고 → 확인완료일만 기입`,
        skipShipWrite: true,
      });
      continue;
    }

    const payMethods = new Set(excRows.map(r => r.pay));
    if (payMethods.size > 1) {
      issues.push({ order_no: orderNo, issue_type: '지불방법혼재', description: `같은 주문에 지불방법이 여럿: ${[...payMethods].join(', ')}`, return_rows: retRows.map(r => r.row), exchange_rows: excRows.map(r => r.row) });
      continue;
    }

    const pay = [...payMethods][0];
    let shipDate, reason;

    if (pay === '입금요청') {
      shipDate = arrivalTag(today);
      reason = '지불방법=입금요청 → 입고MMDD';
    } else if (validPay.has(pay)) {
      if (excRows.every(r => r.newOpt)) {
        shipDate = nextShippingDate(today);
        reason = `지불방법='${pay}', 출고옵션 모두 채워짐 → 다음출고일`;
      } else {
        shipDate = arrivalTag(today);
        reason = `지불방법='${pay}', 출고옵션 일부 비어있음 → 입고MMDD`;
      }
    } else {
      issues.push({ order_no: orderNo, issue_type: '알수없는지불방법', description: `지불방법='${pay}' — 규칙에 없는 값`, return_rows: retRows.map(r => r.row), exchange_rows: excRows.map(r => r.row) });
      continue;
    }

    actions.push({
      order_no: orderNo,
      exchange_rows: excRows.map(r => r.row),
      return_rows: retRows.map(r => r.row),
      ship_date: shipDate,
      done_date: today,
      reason,
      skipShipWrite: false,
    });
  }

  return { actions, issues };
}

// ── 시트 반영 ────────────────────────────────────────────────────
async function applyActions(jwt, actions, exchangeSheet, excShipCol, retDoneCol) {
  const excUpdates = actions.filter(act => !act.skipShipWrite).flatMap(act =>
    act.exchange_rows.map(row => ({ range: `'${exchangeSheet}'!${rowColToA1(row, excShipCol)}`, values: [[act.ship_date]] }))
  );
  const retUpdates = actions.flatMap(act =>
    act.return_rows.map(row => ({ range: `'판토스_입고리스트'!${rowColToA1(row, retDoneCol)}`, values: [[act.done_date]] }))
  );

  if (excUpdates.length) await sheetsBatchUpdate(jwt, EXCHANGE_SS_ID, excUpdates);
  if (retUpdates.length) await sheetsBatchUpdate(jwt, RETURNS_SS_ID, retUpdates);

  return { excUpdated: excUpdates.length, retUpdated: retUpdates.length };
}

// ── 핸들러 ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apply = false, today = new Date().toISOString().slice(0, 10), category = '자사몰교환' } = req.body || {};

  const config = CATEGORY_CONFIGS[category];
  if (!config) return res.status(400).json({ error: `알 수 없는 category: ${category}` });

  try {
    const jwt = getJwt();

    // 헤더 행을 먼저 읽어 열 위치를 확인 (항상 A열부터 절대 인덱스로 통일)
    const [retHeader, excHeader] = await Promise.all([
      sheetsGet(jwt, RETURNS_SS_ID, `'판토스_입고리스트'!1:1`),
      sheetsGet(jwt, EXCHANGE_SS_ID, `'${config.exchangeSheet}'!1:1`),
    ]);
    const retCols = resolveColumns(retHeader[0], RETURNS_HEADER_SPEC, '판토스_입고리스트');
    const excCols = resolveColumns(excHeader[0], EXCHANGE_HEADER_SPEC, config.exchangeSheet);

    // 반품입고시트(판토스_입고리스트)는 완료 건을 수동으로 주기적으로
    // 히스토리 시트로 이관해 작게(미처리 건만) 유지하므로, 전체를 그냥
    // 한 번에 읽는다. (예전엔 E열 거대 수식 때문에 청크로 나눠 읽어야
    // 했지만, 그 수식은 코드로 대체되어 더 이상 문제가 되지 않음 —
    // 업데이트기록.md 2026-07-06 참고)
    const START_ROW = 3;
    const [retRows, excRows] = await Promise.all([
      sheetsGet(jwt, RETURNS_SS_ID, `'판토스_입고리스트'!A${START_ROW}:Z`),
      sheetsGet(jwt, EXCHANGE_SS_ID, `'${config.exchangeSheet}'!A${START_ROW}:Z`),
    ]);

    const returnsGroups  = parseReturns(retRows, START_ROW, retCols);
    const exchangeGroups = parseExchanges(excRows, START_ROW, excCols);

    const { actions, issues } = reconcile(returnsGroups, exchangeGroups, today, config.validPay, category);

    let applied = null;
    if (apply && actions.length > 0) {
      applied = await applyActions(jwt, actions, config.exchangeSheet, excCols.shipDate + 1, retCols.doneDate + 1);
    }

    res.json({ actions, issues, applied, today, category });
  } catch (err) {
    console.error('[reconcile]', err);
    res.status(500).json({ error: err.message });
  }
}
