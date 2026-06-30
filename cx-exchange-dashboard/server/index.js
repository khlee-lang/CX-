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
