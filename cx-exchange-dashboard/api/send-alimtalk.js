import { dispatchAlimtalk } from './_alimtalk.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { row } = req.body;
  if (!row) return res.status(400).json({ error: 'row is required.' });

  try {
    const result = await dispatchAlimtalk(row);

    console.log('[alimtalk]', JSON.stringify({
      orderNumber: row['주문번호'],
      phone: row['연락처'],
      templateId: result.templateId,
      success: result.success,
    }));

    if (result.success) {
      res.json({ success: true, sentDate: result.result_msg, templateId: result.templateId });
    } else {
      res.status(500).json({ error: result.error || '알림톡 발송 실패', details: result });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
