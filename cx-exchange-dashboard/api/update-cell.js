import { createDoc } from './_sheets.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const { sheetTitle, rowIndex, column, value } = req.body;
  if (!sheetTitle) return res.status(400).json({ error: 'sheetTitle is required.' });
  if (rowIndex === undefined || rowIndex === null) return res.status(400).json({ error: 'rowIndex is required.' });
  if (!column) return res.status(400).json({ error: 'column name is required.' });

  const numericRowIndex = parseInt(rowIndex);
  if (isNaN(numericRowIndex)) return res.status(400).json({ error: 'rowIndex must be a number.' });

  try {
    const doc = createDoc();
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) return res.status(404).json({ error: `Sheet "${sheetTitle}" not found.` });

    const rows = await sheet.getRows();
    const targetRow = rows.find(r => r.rowNumber === numericRowIndex);
    if (!targetRow) return res.status(404).json({ error: `Row ${numericRowIndex} not found.` });

    targetRow.set(column, value);
    await targetRow.save();

    res.json({ success: true, rowIndex: numericRowIndex, column, value });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
