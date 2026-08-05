import { createDoc, getJwt, SPREADSHEET_ID } from './_sheets.js';
import feedbackHandler from './_feedback.js';

// 재고관리 시트 J열은 재고수량이 수식으로 채워지는 열인데, 헤더행(1행)에
// 이름이 없어서 google-spreadsheet 라이브러리(row.get(header))로는 못 읽는다.
// row.rowNumber를 기준으로 raw REST 조회 결과와 매칭해서 별도로 붙여준다.
async function fetchStockColumn() {
  const jwt = getJwt();
  const { token } = await jwt.getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'재고관리'!J2:J")}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || '재고 열 조회 실패');
  return data.values || [];
}

export default async function handler(req, res) {
  // Vercel Hobby 함수 12개 제한 → 수정요청(피드백) API를 이 함수에 합치고
  // ?resource=feedback 으로 분기한다 (exchange-history.js와 동일 패턴).
  if (req.query.resource === 'feedback') return feedbackHandler(req, res);

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const doc = createDoc();
    await doc.loadInfo();

    const getSheet = async (title) => {
      const sheet = doc.sheetsByTitle[title];
      if (!sheet) return null;
      const rows = await sheet.getRows();
      return rows.map(row => {
        const data = {};
        sheet.headerValues.forEach(h => { data[h] = row.get(h); });
        data['__rowIndex'] = row.rowNumber;
        return data;
      });
    };

    const [jasaMall, bulryang, oebuMall, inventory] = await Promise.all([
      getSheet('[자사몰] 교환'),
      getSheet('[불량] 교환'),
      getSheet('[외부몰] 교환'),
      getSheet('재고관리'),
    ]);

    if (inventory && inventory.length > 0) {
      const stockCol = await fetchStockColumn();
      inventory.forEach(row => {
        const idx = row.__rowIndex - 2; // J2가 배열 인덱스 0
        row['재고'] = (stockCol[idx]?.[0] || '').toString().replace(/,/g, '').trim();
      });
    }

    res.json({ spreadsheetTitle: doc.title, data: { jasaMall, bulryang, oebuMall, inventory } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
