const fetch = require('node-fetch');

const API_URL = 'http://localhost:3001/api/send-alimtalk';
const rowIndex = 5617; // 'test' 주문의 실제 행 인덱스

const baseRow = {
  '주문번호': 'test',
  '연락처': '010-8302-1924',
  '수령자': '양나형',
  '택배비': '3000',
  '지불방법': '입금요청',
  '교환 출고 옵션': '[블랙-S]',
  '출고일': ''
};

const tests = [
  {
    name: '50195 (입고됨 + 미입금)',
    row: { ...baseRow, '출고일': '입고0407', '지불방법': '입금요청', '교환 출고 옵션': '[블랙-S]' }
  },
  {
    name: '50196 (입고됨 + 옵션 누락)',
    row: { ...baseRow, '출고일': '입고0407', '지불방법': '입금확인', '교환 출고 옵션': '' }
  },
  {
    name: '50197 (입고됨 + 미입금 + 옵션 누락)',
    row: { ...baseRow, '출고일': '입고0407', '지불방법': '입금요청', '교환 출고 옵션': '' }
  },
  {
    name: '50198 (미입금만)',
    row: { ...baseRow, '출고일': '', '지불방법': '입금요청', '교환 출고 옵션': '[블랙-S]' }
  },
  {
    name: '50199 (옵션 누락만)',
    row: { ...baseRow, '출고일': '', '지불방법': '입금확인', '교환 출고 옵션': '' }
  },
  {
    name: '50200 (미입금 + 옵션 누락)',
    row: { ...baseRow, '출고일': '', '지불방법': '입금요청', '교환 출고 옵션': '' }
  }
];

async function runTests() {
  for (const t of tests) {
    console.log(`\nTesting: ${t.name}...`);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex, row: t.row })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ Success: Template ${data.templateId} sent.`);
      } else {
        console.log(`❌ Failed: ${data.error}`);
      }
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
    }
  }
}

runTests();
