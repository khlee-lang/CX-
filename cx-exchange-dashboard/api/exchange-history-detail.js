import {
  createBigQuery,
  createBigQueryWithGcloudToken,
  isLocalDev,
  HISTORICAL_EXCHANGE_TABLE,
  BQ_LOCATION,
} from './_bigquery.js';

// 관제 그래프 드릴다운 — 특정 기간×채널그룹의 TOP 상품 + 불량 사유 분포.
// exchange_historical(2024-05-28~2026-01-06)만 대상. 그 이후 기간은 프론트가
// 이미 들고 있는 라이브 구글시트 행에서 클라이언트 쪽에서 직접 집계한다.
const PRODUCT_QUERY = `
  SELECT product_name AS name, COUNT(*) AS cnt
  FROM ${HISTORICAL_EXCHANGE_TABLE}
  WHERE receipt_date BETWEEN @start AND @end AND channel_group = @channelGroup
  GROUP BY 1
  ORDER BY cnt DESC
  LIMIT 5
`;

const REASON_QUERY = `
  SELECT
    CASE WHEN is_defect THEN reason_or_pay_method ELSE NULL END AS reason,
    COUNT(*) AS cnt
  FROM ${HISTORICAL_EXCHANGE_TABLE}
  WHERE receipt_date BETWEEN @start AND @end AND channel_group = @channelGroup AND is_defect
  GROUP BY 1
  ORDER BY cnt DESC
  LIMIT 8
`;

const TOTAL_QUERY = `
  SELECT COUNT(*) AS cnt, COUNTIF(is_defect) AS defectCnt
  FROM ${HISTORICAL_EXCHANGE_TABLE}
  WHERE receipt_date BETWEEN @start AND @end AND channel_group = @channelGroup
`;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { start, end, channelGroup } = req.query;
  if (!YMD.test(start || '') || !YMD.test(end || '')) {
    return res.status(400).json({ error: '날짜 형식(YYYY-MM-DD)이 올바르지 않습니다.' });
  }
  if (channelGroup !== 'jasa' && channelGroup !== 'oebu') {
    return res.status(400).json({ error: 'channelGroup은 jasa 또는 oebu여야 합니다.' });
  }

  try {
    let bq = createBigQuery();
    try {
      await bq.query({ query: 'SELECT 1', location: BQ_LOCATION });
    } catch (authErr) {
      if (isLocalDev() && /permission|access denied/i.test(authErr.message)) {
        console.warn('[exchange-history-detail] SA 권한 없음 → gcloud 사용자 토큰 fallback (로컬 전용)');
        bq = createBigQueryWithGcloudToken();
      } else {
        throw authErr;
      }
    }

    const params = { start, end, channelGroup };
    const [[topProducts], [reasonRows], [totalRows]] = await Promise.all([
      bq.query({ query: PRODUCT_QUERY, params, location: BQ_LOCATION }),
      bq.query({ query: REASON_QUERY, params, location: BQ_LOCATION }),
      bq.query({ query: TOTAL_QUERY, params, location: BQ_LOCATION }),
    ]);

    return res.json({
      range: { start, end },
      channelGroup,
      totalCount: totalRows[0]?.cnt || 0,
      defectCount: totalRows[0]?.defectCnt || 0,
      topProducts,
      reasonDistribution: reasonRows.filter((r) => r.reason),
    });
  } catch (err) {
    console.error('[exchange-history-detail] BigQuery error:', err);
    return res.status(502).json({ error: 'BigQuery 조회 실패: ' + err.message, source: 'bigquery' });
  }
}
