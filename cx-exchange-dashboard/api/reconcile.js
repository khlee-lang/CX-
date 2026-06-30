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
async function sheetsGet(jwt, ssId, range) {
  const { token } = await jwt.getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Sheets GET 오류');
  return data.values || [];
}

async function sheetsBatchUpdate(jwt, ssId, updates) {
  const { token } = await jwt.getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updates }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Sheets batchUpdate 오류');
  return data;
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
const EC_PAY_METHOD = 3;
const EC_ORDER_NO   = 5;
const EC_PREV_OPT   = 6;
const EC_ITEM_NAME  = 7;
const EC_NEW_OPT    = 8;
const EC_QTY        = 9;
const WRITE_E_SHIP_COL = 2; // B열

const VALID_PAY = new Set(['', '무상', '입금확인', '무료교환', '차감']);

// ── 파싱 ─────────────────────────────────────────────────────────
function parseReturns(rows) {
  const groups = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (safeGet(row, RC_DONE_DATE)) continue;
    if (safeGet(row, RC_CATEGORY) !== '자사몰교환') continue;
    const orderNo = safeGet(row, RC_ORDER_NO);
    if (!orderNo) continue;
    const item = safeGet(row, RC_ITEM);
    const qtyRaw = safeGet(row, RC_REAL_QTY) || safeGet(row, RC_QTY);
    const qty = parseInt(qtyRaw) || 0;
    if (!groups[orderNo]) groups[orderNo] = [];
    groups[orderNo].push({ row: i + 1, item, qty }); // 1-based 시트 행번호
  }
  return groups;
}

function parseExchanges(rows) {
  const groups = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const orderNo = safeGet(row, EC_ORDER_NO);
    if (!orderNo) continue;
    const itemKey = safeGet(row, EC_ITEM_NAME) + safeGet(row, EC_PREV_OPT);
    const qty = parseInt(safeGet(row, EC_QTY)) || 0;
    if (!groups[orderNo]) groups[orderNo] = [];
    groups[orderNo].push({
      row: i + 1,
      itemKey,
      qty,
      pay: safeGet(row, EC_PAY_METHOD),
      newOpt: safeGet(row, EC_NEW_OPT),
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
    });
  }

  return { actions, issues };
}

// ── 시트 반영 ────────────────────────────────────────────────────
async function applyActions(jwt, actions) {
  const excUpdates = actions.flatMap(act =>
    act.exchange_rows.map(row => ({ range: rowColToA1(row, WRITE_E_SHIP_COL), values: [[act.ship_date]] }))
  );
  const retUpdates = actions.flatMap(act =>
    act.return_rows.map(row => ({ range: rowColToA1(row, WRITE_R_DONE_COL), values: [[act.done_date]] }))
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

    const [retRows, excRows] = await Promise.all([
      sheetsGet(jwt, RETURNS_SS_ID, 'C:O'),
      sheetsGet(jwt, EXCHANGE_SS_ID, "'[자사몰] 교환'!B:K"),
    ]);

    const returnsGroups  = parseReturns(retRows);
    const exchangeGroups = parseExchanges(excRows);

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
