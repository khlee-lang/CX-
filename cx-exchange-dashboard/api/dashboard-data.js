import { createDoc } from './_sheets.js';

export default async function handler(req, res) {
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

    res.json({ spreadsheetTitle: doc.title, data: { jasaMall, bulryang, oebuMall, inventory } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
