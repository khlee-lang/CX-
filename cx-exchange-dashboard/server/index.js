const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = 3001;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// 배포: GOOGLE_SERVICE_ACCOUNT_JSON 환경변수(JSON 문자열)를 우선 사용
// 로컬: service-account.json 파일 fallback
let creds;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
} else {
  creds = require('./service-account.json');
}

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const jwt = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: SCOPES,
});

const SPREADSHEET_ID = '1cqLifjcihpHlAUN9ZcG19uJ9MhdkYcOxLzMDPcaBufg';
const doc = new GoogleSpreadsheet(SPREADSHEET_ID, jwt);

// 재고관리 시트 J열은 재고수량이 수식으로 채워지는 열인데, 헤더행(1행)에
// 이름이 없어서 google-spreadsheet 라이브러리(row.get(header))로는 못 읽는다.
// row.rowNumber를 기준으로 raw REST 조회 결과와 매칭해서 별도로 붙여준다.
async function fetchStockColumn() {
  const { token } = await jwt.getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'재고관리'!J2:J")}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || '재고 열 조회 실패');
  return data.values || [];
}

// ── GET: 대시보드 전체 데이터 읽기 ─────────────────────────────
app.get('/api/dashboard-data', async (req, res) => {
  try {
    await doc.loadInfo();

    const getSheetData = async (title) => {
      const sheet = doc.sheetsByTitle[title];
      if (!sheet) return null;
      const rows = await sheet.getRows();
      return rows.map(row => {
        const rowData = {};
        sheet.headerValues.forEach(header => {
          rowData[header] = row.get(header);
        });
        // 행 인덱스를 저장해 나중에 수정할 때 사용
        rowData['__rowIndex'] = row.rowNumber;
        return rowData;
      });
    };

    const [jasaMall, bulryang, oebuMall, inventory] = await Promise.all([
      getSheetData('[자사몰] 교환'),
      getSheetData('[불량] 교환'),
      getSheetData('[외부몰] 교환'),
      getSheetData('재고관리')
    ]);

    if (inventory && inventory.length > 0) {
      const stockCol = await fetchStockColumn();
      inventory.forEach(row => {
        const idx = row.__rowIndex - 2; // J2가 배열 인덱스 0
        row['재고'] = (stockCol[idx]?.[0] || '').toString().replace(/,/g, '').trim();
      });
    }

    res.json({
      spreadsheetTitle: doc.title,
      data: { jasaMall, bulryang, oebuMall, inventory }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── PATCH: 특정 셀 업데이트 ─────────────────────────────────────
// Body: { sheetTitle, rowIndex, column, value }
app.patch('/api/update-cell', async (req, res) => {
  let { sheetTitle, rowIndex, column, value } = req.body;
  console.log('PATCH Request Body:', req.body);

  if (!sheetTitle) return res.status(400).json({ error: 'sheetTitle is required.' });
  if (rowIndex === undefined || rowIndex === null) return res.status(400).json({ error: 'rowIndex is required.' });
  if (!column) return res.status(400).json({ error: 'column name is required.' });

  const numericRowIndex = parseInt(rowIndex);
  if (isNaN(numericRowIndex)) return res.status(400).json({ error: 'rowIndex must be a number.' });

  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) return res.status(404).json({ error: `Sheet "${sheetTitle}" not found.` });

    const rows = await sheet.getRows();
    // rowNumber는 1-indexed (헤더 포함), 데이터 행은 2번부터 시작
    const targetRow = rows.find(r => r.rowNumber === rowIndex);
    if (!targetRow) return res.status(404).json({ error: `Row ${rowIndex} not found.` });

    targetRow.set(column, value);
    await targetRow.save();

    res.json({ success: true, rowIndex, column, value });
  } catch (error) {
    console.error('Error updating cell:', error);
    res.status(500).json({ error: error.message });
  }
});

// 헤더 텍스트로 열 위치(0-based)를 찾는 유틸.
// 배경: 반품입고시트에서 "수동구분" 열이 삭제되자 그 뒤 모든 열이 한 칸씩
// 밀렸는데, 예전엔 열을 고정 숫자로 하드코딩해서 조용히 엉뚱한 데이터를
// 읽고 있었음(2026-07-09 발견). 헤더 텍스트 기준으로 매번 다시 찾고,
// 못 찾으면 에러를 던져서 조용히 틀리게 동작하는 일이 없도록 한다.
function resolveColumns(headerRow, spec, sheetLabel) {
  const trimmed = (headerRow || []).map(h => (h || '').toString().trim());
  const result = {};
  const missing = [];
  for (const [key, name] of Object.entries(spec)) {
    const idx = trimmed.indexOf(name);
    if (idx === -1) missing.push(name);
    else result[key] = idx;
  }
  if (missing.length > 0) {
    throw new Error(`${sheetLabel ? `[${sheetLabel}] ` : ''}시트 헤더에서 다음 열을 찾을 수 없습니다: ${missing.join(', ')} (현재 헤더: ${trimmed.join(', ')})`);
  }
  return result;
}

// ── POST: 반품입고-교환 연동 ─────────────────────────────────────
app.post('/api/reconcile', async (req, res) => {
  const { apply = false, today = new Date().toISOString().slice(0, 10), category = '자사몰교환' } = req.body || {};

  const RETURNS_SS_ID  = '1B6UKmborJQCAKIrIBziAFMjKR0CfY8Jul1E_Rbs5C3Y';
  const EXCHANGE_SS_ID = '1cqLifjcihpHlAUN9ZcG19uJ9MhdkYcOxLzMDPcaBufg';

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
  const config = CATEGORY_CONFIGS[category];
  if (!config) return res.status(400).json({ error: `알 수 없는 category: ${category}` });

  const RETURNS_HEADER_SPEC = { doneDate: '완료일', category: '구분', orderNo: '주문번호', item: '상품명/옵션명', qty: '수량', realQty: '실수량' };
  const EXCHANGE_HEADER_SPEC = { shipDate: '출고일', payMethod: '지불방법', orderNo: '주문번호', prevOpt: '교환 전 옵션', itemName: '상품명', newOpt: '교환 출고 옵션', qty: '수량' };

  const localJwt = new JWT({ email: creds.client_email, key: creds.private_key, scopes: SCOPES });

  async function sheetsGet(ssId, range) {
    const { token } = await localJwt.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values/${encodeURIComponent(range)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'Sheets GET 오류');
    return d.values || [];
  }

  async function sheetsBatchUpdate(ssId, updates) {
    const { token } = await localJwt.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values:batchUpdate`;
    const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updates }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'batchUpdate 오류');
  }

  function rowColToA1(row, col) {
    let s = '', c = col;
    while (c > 0) { s = String.fromCharCode(64 + (c % 26 || 26)) + s; c = Math.floor((c - 1) / 26); }
    return `${s}${row}`;
  }
  function nextShippingDate(d) {
    const dt = new Date(d); dt.setDate(dt.getDate() + 1);
    const day = dt.getDay();
    if (day === 6) dt.setDate(dt.getDate() + 2); else if (day === 0) dt.setDate(dt.getDate() + 1);
    return dt.toISOString().slice(0, 10);
  }
  function arrivalTag(d) { const dt = new Date(d); return `입고${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}`; }
  function sg(row, i) { return (row?.[i] ?? '').toString().trim(); }

  // 카테고리로 미리 걸러내지 않고 전부 그룹에 담는다 (2026-07-10) — 신청하지
  // 않은 상품이 같이 반품되면 그 행 구분값이 다르게 매겨지는데, 여기서
  // 미리 걸러내면 reconcile()이 그 사실을 알 수 없어 "정상 처리"로
  // 잘못 통과시키는 사고가 있었음.
  // done(완료 처리된) 행도 그룹에 포함시킨다 — 신청한 상품만 먼저 들어와 처리가
  // 끝난 뒤, 상관없는 반품 상품이 같은 주문번호로 나중에 들어오는 경우를 잡아내려면
  // "이미 끝난 행"의 존재도 알아야 하기 때문 (2026-07-15: 이 케이스를 못 잡아서
  // 조용히 넘어간 사고 이후 추가).
  function parseReturns(rows, rowOffset, cols) {
    const g = {};
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const o = sg(r,cols.orderNo); if (!o) continue;
      if (!g[o]) g[o] = [];
      g[o].push({ row: rowOffset+i, item: sg(r,cols.item), qty: parseInt(sg(r,cols.realQty)||sg(r,cols.qty))||0, category: sg(r,cols.category), done: !!sg(r,cols.doneDate) });
    }
    return g;
  }
  function parseExchanges(rows, rowOffset, cols) {
    const g = {};
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const o = sg(r,cols.orderNo); if (!o) continue;
      if (!g[o]) g[o] = [];
      g[o].push({ row: rowOffset+i, itemKey: sg(r,cols.itemName)+sg(r,cols.prevOpt), qty: parseInt(sg(r,cols.qty))||0, pay: sg(r,cols.payMethod), newOpt: sg(r,cols.newOpt), existingShipDate: sg(r,cols.shipDate) });
    }
    return g;
  }
  function counterEqual(ret, exc) {
    const cR={}, cE={};
    for (const r of ret) cR[r.item]=(cR[r.item]||0)+r.qty;
    for (const r of exc) cE[r.itemKey]=(cE[r.itemKey]||0)+r.qty;
    const kR=Object.keys(cR).sort(), kE=Object.keys(cE).sort();
    if (kR.length!==kE.length) return false;
    return kR.every((k,i)=>k===kE[i]&&cR[k]===cE[k]);
  }
  function reconcile(rg, eg, t, validPay, category) {
    const actions=[], issues=[];
    for (const [o, allRetRows] of Object.entries(rg)) {
      if (!allRetRows.some(r=>r.category===category)) continue;

      const categories = [...new Set(allRetRows.map(r=>r.category))];
      if (categories.length > 1) {
        const alreadyDone = allRetRows.some(r=>r.done);
        issues.push({order_no:o,issue_type:'카테고리혼재',description: alreadyDone
          ? `이 주문번호는 이미 일부 처리 완료됐는데, 이후 구분값이 다른 반품 항목이 추가로 들어왔습니다(${categories.join(', ')}) — 신청하지 않은 상품이 나중에 같이 반품됐을 수 있습니다.`
          : `반품입고시트에 이 주문번호로 구분값이 여러 개 섞여 있습니다(${categories.join(', ')}) — 신청하지 않은 상품이 같이 반품됐을 수 있습니다.`,return_rows:allRetRows.map(r=>r.row)});
        continue;
      }

      const retRows = allRetRows.filter(r=>!r.done);
      if (retRows.length === 0) continue; // 이미 전부 처리 완료된 주문
      const excRows = eg[o];
      if (!excRows) { issues.push({order_no:o,issue_type:'주문없음',description:'교환접수시트에 해당 주문번호가 없습니다.',return_rows:retRows.map(r=>r.row)}); continue; }
      if (!counterEqual(retRows,excRows)) { issues.push({order_no:o,issue_type:'상품불일치',description:'반품입고와 교환접수의 상품/옵션/수량이 일치하지 않습니다.',return_rows:retRows.map(r=>r.row),exchange_rows:excRows.map(r=>r.row)}); continue; }

      const existingShipDate = excRows.find(r=>r.existingShipDate)?.existingShipDate;
      if (existingShipDate) {
        actions.push({order_no:o,exchange_rows:excRows.map(r=>r.row),return_rows:retRows.map(r=>r.row),ship_date:`이미출고됨(${existingShipDate})`,done_date:t,reason:`${existingShipDate} 선출고 → 확인완료일만 기입`,skipShipWrite:true});
        continue;
      }

      const pays=new Set(excRows.map(r=>r.pay));
      if (pays.size>1) { issues.push({order_no:o,issue_type:'지불방법혼재',description:`지불방법이 여럿: ${[...pays].join(', ')}`,return_rows:retRows.map(r=>r.row),exchange_rows:excRows.map(r=>r.row)}); continue; }
      const pay=[...pays][0]; let shipDate, reason;
      if (pay==='입금요청') { shipDate=arrivalTag(t); reason='지불방법=입금요청 → 입고MMDD'; }
      else if (validPay.has(pay)) { if (excRows.every(r=>r.newOpt)) { shipDate=nextShippingDate(t); reason=`지불방법='${pay}', 출고옵션 모두 채워짐 → 다음출고일`; } else { shipDate=arrivalTag(t); reason=`지불방법='${pay}', 출고옵션 일부 비어있음 → 입고MMDD`; } }
      else { issues.push({order_no:o,issue_type:'알수없는지불방법',description:`지불방법='${pay}'`,return_rows:retRows.map(r=>r.row),exchange_rows:excRows.map(r=>r.row)}); continue; }
      actions.push({order_no:o,exchange_rows:excRows.map(r=>r.row),return_rows:retRows.map(r=>r.row),ship_date:shipDate,done_date:t,reason,skipShipWrite:false});
    }
    return {actions,issues};
  }

  try {
    const START_ROW = 3;
    const [retHeader, excHeader] = await Promise.all([
      sheetsGet(RETURNS_SS_ID, `'판토스_입고리스트'!1:1`),
      sheetsGet(EXCHANGE_SS_ID, `'${config.exchangeSheet}'!1:1`),
    ]);
    const retCols = resolveColumns(retHeader[0], RETURNS_HEADER_SPEC, '판토스_입고리스트');
    const excCols = resolveColumns(excHeader[0], EXCHANGE_HEADER_SPEC, config.exchangeSheet);

    const [retRows, excRows] = await Promise.all([
      sheetsGet(RETURNS_SS_ID, `'판토스_입고리스트'!A${START_ROW}:Z`),
      sheetsGet(EXCHANGE_SS_ID, `'${config.exchangeSheet}'!A${START_ROW}:Z`),
    ]);
    const {actions,issues} = reconcile(parseReturns(retRows, START_ROW, retCols), parseExchanges(excRows, START_ROW, excCols), today, config.validPay, category);
    let applied = null;
    if (apply && actions.length > 0) {
      const excShipCol = excCols.shipDate + 1;
      const retDoneCol = retCols.doneDate + 1;
      const excU = actions.filter(a=>!a.skipShipWrite).flatMap(a=>a.exchange_rows.map(r=>({range:`'${config.exchangeSheet}'!${rowColToA1(r,excShipCol)}`,values:[[a.ship_date]]})));
      const retU = actions.flatMap(a=>a.return_rows.map(r=>({range:`'판토스_입고리스트'!${rowColToA1(r,retDoneCol)}`,values:[[a.done_date]]})));
      if (excU.length) await sheetsBatchUpdate(EXCHANGE_SS_ID, excU);
      if (retU.length) await sheetsBatchUpdate(RETURNS_SS_ID, retU);
      applied = {excUpdated:excU.length, retUpdated:retU.length};
    }
    res.json({actions,issues,applied,today,category});
  } catch (err) {
    console.error('[reconcile]', err);
    res.status(500).json({error: err.message});
  }
});

// 리터니즈 업로드는 api/upload-returnize.js(Vercel 서버리스 함수)를 그대로 재사용 —
// ESM 모듈이라 동적 import로 불러와서 Express req/res에 그대로 위임한다.
app.post('/api/upload-returnize', async (req, res) => {
  const { default: handler } = await import('../api/upload-returnize.js');
  return handler(req, res);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// ── POST: 알림톡 발송 ─────────────────────────────────────────────
// Body: { rowIndex, sheetTitle, row }  (row = 해당 행 전체 데이터)
app.post('/api/send-alimtalk', async (req, res) => {
  const { rowIndex, sheetTitle = '[자사몰] 교환', row } = req.body;

  if (!rowIndex || !row) {
    return res.status(400).json({ error: 'rowIndex and row are required.' });
  }

  const LUNASOFT_URL = 'https://jupiter.lunasoft.co.kr/api/AlimTalk/message/send';
  const LUNASOFT_AUTH = {
    userid: 'verish',
    api_key: 'rxnqi0z69j5te3d3duhgvxi12dfxio7jdl58a8la'
  };

  const LOG_FILE = path.join(__dirname, 'alimtalk.log');

  // 로그 기록 함수
  function logAlimtalk(data) {
    try {
      const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const logEntry = `[${timestamp}] ${JSON.stringify(data, null, 2)}\n${'-'.repeat(50)}\n`;
      fs.appendFileSync(LOG_FILE, logEntry);
    } catch (err) {
      console.error('Logging error:', err);
    }
  }

  const phone = (row['연락처'] || '').replace(/[^0-9]/g, '');
  const orderNumber = (row['주문번호'] || '').trim();
  const name = (row['수령자'] || '').trim();
  const payMethod = (row['지불방법'] || '').trim();
  const option = (row['교환 출고 옵션'] || '').trim();
  const fee = (row['택배비'] || '0').replace(/,/g, '').trim();
  const today = new Date().toISOString().split('T')[0];

  // 전화번호 유효성 체크
  if (!/^010\d{8}$/.test(phone)) {
    return res.status(400).json({ error: '유효하지 않은 전화번호입니다.' });
  }

  const hasMissingOption = !option || option === '확인중';
  const hasUnpaid = payMethod === '입금요청' || payMethod === '미입금';
  const shipVal = (row['출고일'] || '').trim();
  const isArrived = /^입고\d{4}$/.test(shipVal); // 입고MMDD 패턴 = 입고됨
  const depositor = `${name}${phone.slice(-4)}`;

  // ── Python 기반 알림톡 엔진 호출 ──────────────────────────────
  try {
    const { exec } = require('child_process');
    const pythonPath = process.env.PYTHON_PATH || '/usr/bin/python3';
    const scriptPath = process.env.PYTHON_SCRIPT_PATH || path.join(__dirname, '../../send_single_python.py');
    
    // Python 실행 - 행 전체 데이터를 JSON으로 전달
    const payload = JSON.stringify({ row, rowIndex, sheetTitle });
    
    exec(`${pythonPath} "${scriptPath}" '${payload.replace(/'/g, "'\\''")}'`, async (err, stdout, stderr) => {
      // stderr가 있더라도 Warning일 수 있으므로 err(종료코드)를 우선 확인
      if (err) {
        console.error('Python process error:', err);
        logAlimtalk({ orderNumber, phone: row['연락처'], error: `Python failed with exit code ${err.code}: ${stderr}` });
        return res.status(500).json({ error: 'Python 엔진 실행 실패' });
      }

      try {
        const result = JSON.parse(stdout);
        const { success, result_msg: resultMsg, template_id: templateId, phone: cleanedPhone } = result;

        // 상세 로그 기록
        logAlimtalk({
          orderNumber,
          phone: cleanedPhone,
          templateId,
          python_output: result
        });

        if (success) {
          res.json({ success: true, sentDate: today, templateId });
        } else {
          res.status(500).json({ error: '알림톡 발송 실패 (Python 엔진)', details: result });
        }
      } catch (parseErr) {
        console.error('Python output parse error:', parseErr, stdout);
        res.status(500).json({ error: 'Python 출력 해석 오류', stdout });
      }
    });
  } catch (error) {
    console.error('AlimTalk overall error:', error);
    res.status(500).json({ error: error.message });
  }
});
