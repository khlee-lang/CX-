import { JWT } from 'google-auth-library';
import { createRequire } from 'module';

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

// ── 반품입고시트 (C:O) 인덱스 ────────────────────────────────────
// C=0 확인완료일, E=2 구분, J=7 주문번호, M=10 상품명/옵션명, N=11 수량, O=12 실수량
const RC_DONE_DATE = 0;
const RC_CATEGORY  = 2;
const RC_ORDER_NO  = 7;
const RC_ITEM      = 10;
const RC_QTY       = 11;
const RC_REAL_QTY  = 12;
const WRITE_R_DONE_COL = 3; // C열

// ── 교환접수시트 (B:K) 인덱스 ────────────────────────────────────
// B=0 출고일, E=3 지불방법, G=5 주문번호, H=6 교환전옵션, I=7 상품명, J=8 교환출고옵션, K=9 수량
const EC_SHIP_DATE  = 0;
const EC_PAY_METHOD = 3;
const EC_ORDER_NO   = 5;
const EC_PREV_OPT   = 6;
const EC_ITEM_NAME  = 7;
const EC_NEW_OPT    = 8;
const EC_QTY        = 9;
const WRITE_E_SHIP_COL = 2; // B열

const VALID_PAY = new Set(['', '무상', '입금확인', '무료교환', '차감']);

// ── 파싱 ─────────────────────────────────────────────────────────
// rowOffset: 시트에서 실제 읽기 시작한 행번호 (1-based)
function parseReturns(rows, rowOffset) {
  const groups = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (safeGet(row, RC_DONE_DATE)) continue;
    if (safeGet(row, RC_CATEGORY) !== '자사몰교환') continue;
    const orderNo = safeGet(row, RC_ORDER_NO);
    if (!orderNo) continue;
    const item = safeGet(row, RC_ITEM);
    const qtyRaw = safeGet(row, RC_REAL_QTY) || safeGet(row, RC_QTY);
    const qty = parseInt(qtyRaw) || 0;
    if (!groups[orderNo]) groups[orderNo] = [];
    groups[orderNo].push({ row: rowOffset + i, item, qty });
  }
  return groups;
}

function parseExchanges(rows, rowOffset) {
  const groups = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const orderNo = safeGet(row, EC_ORDER_NO);
    if (!orderNo) continue;
    const itemKey = safeGet(row, EC_ITEM_NAME) + safeGet(row, EC_PREV_OPT);
    const qty = parseInt(safeGet(row, EC_QTY)) || 0;
    if (!groups[orderNo]) groups[orderNo] = [];
    groups[orderNo].push({
      row: rowOffset + i,
      itemKey,
      qty,
      pay: safeGet(row, EC_PAY_METHOD),
      newOpt: safeGet(row, EC_NEW_OPT),
      existingShipDate: safeGet(row, EC_SHIP_DATE),
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
function reconcile(returnsGroups, exchangeGroups, today) {
  const actions = [];
  const issues  = [];

  for (const [orderNo, retRows] of Object.entries(returnsGroups)) {
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
    } else if (VALID_PAY.has(pay)) {
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
async function applyActions(jwt, actions) {
  const excUpdates = actions.filter(act => !act.skipShipWrite).flatMap(act =>
    act.exchange_rows.map(row => ({ range: `'[자사몰] 교환'!${rowColToA1(row, WRITE_E_SHIP_COL)}`, values: [[act.ship_date]] }))
  );
  const retUpdates = actions.flatMap(act =>
    act.return_rows.map(row => ({ range: `'판토스_입고리스트'!${rowColToA1(row, WRITE_R_DONE_COL)}`, values: [[act.done_date]] }))
  );

  if (excUpdates.length) await sheetsBatchUpdate(jwt, EXCHANGE_SS_ID, excUpdates);
  if (retUpdates.length) await sheetsBatchUpdate(jwt, RETURNS_SS_ID, retUpdates);

  return { excUpdated: excUpdates.length, retUpdated: retUpdates.length };
}

// ── 핸들러 ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apply = false, today = new Date().toISOString().slice(0, 10) } = req.body || {};

  try {
    const jwt = getJwt();

    // 반품입고시트(판토스_입고리스트)는 완료 건을 수동으로 주기적으로
    // 히스토리 시트로 이관해 작게(미처리 건만) 유지하므로, 전체를 그냥
    // 한 번에 읽는다. (예전엔 E열 거대 수식 때문에 청크로 나눠 읽어야
    // 했지만, 그 수식은 코드로 대체되어 더 이상 문제가 되지 않음 —
    // 업데이트기록.md 2026-07-06 참고)
    const START_ROW = 3;
    const [retRows, excRows] = await Promise.all([
      sheetsGet(jwt, RETURNS_SS_ID, `'판토스_입고리스트'!C${START_ROW}:O`),
      sheetsGet(jwt, EXCHANGE_SS_ID, `'[자사몰] 교환'!B${START_ROW}:K`),
    ]);

    const returnsGroups  = parseReturns(retRows, START_ROW);
    const exchangeGroups = parseExchanges(excRows, START_ROW);

    const { actions, issues } = reconcile(returnsGroups, exchangeGroups, today);

    let applied = null;
    if (apply && actions.length > 0) {
      applied = await applyActions(jwt, actions);
    }

    res.json({ actions, issues, applied, today });
  } catch (err) {
    console.error('[reconcile]', err);
    res.status(500).json({ error: err.message });
  }
}
