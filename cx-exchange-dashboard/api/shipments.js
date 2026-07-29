import {
  createBigQuery,
  createBigQueryWithGcloudToken,
  isLocalDev,
  SHIPMENT_TABLE,
  BQ_LOCATION,
} from './_bigquery.js';

// 국내-B2C 출고량 집계. 자사몰 = 카페24(신), 외부몰 = 그 외 국내-B2C.
// CS(딥다이브)는 교환출고 채널이라 교환율 분모에서 제외.
const BASE_CTE = `
  WITH base AS (
    SELECT
      wms_out_confirm_date AS d,
      sales_channel,
      IF(sales_channel = '카페24(신)', 'jasa', 'oebu') AS channel_group,
      name, category1, color, size,
      stockout_cnt
    FROM ${SHIPMENT_TABLE}
    WHERE channel_status = '국내-B2C'
      AND sales_channel != 'CS(딥다이브)'
      AND wms_out_confirm_date BETWEEN @start AND @end
  )
`;

const QUERIES = {
  byDay: `${BASE_CTE}
    SELECT CAST(d AS STRING) AS date, channel_group AS channelGroup, SUM(stockout_cnt) AS qty
    FROM base GROUP BY 1, 2 ORDER BY 1`,
  byChannel: `${BASE_CTE}
    SELECT sales_channel AS salesChannel, channel_group AS channelGroup, SUM(stockout_cnt) AS qty
    FROM base GROUP BY 1, 2 ORDER BY qty DESC`,
  byProduct: `${BASE_CTE}
    SELECT name, ANY_VALUE(category1) AS category1, channel_group AS channelGroup, SUM(stockout_cnt) AS qty
    FROM base GROUP BY name, channel_group`,
  byProductMonth: `${BASE_CTE}
    SELECT FORMAT_DATE('%Y-%m', d) AS month, name, channel_group AS channelGroup, SUM(stockout_cnt) AS qty
    FROM base GROUP BY 1, 2, 3`,
  byOption: `${BASE_CTE}
    SELECT name, color, size, channel_group AS channelGroup, SUM(stockout_cnt) AS qty
    FROM base GROUP BY 1, 2, 3, 4`,
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DATA_MIN_DATE = '2026-03-02';

function kstDateStr(offsetDays = 0) {
  const kst = new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 서버리스 인스턴스별 웜 캐시. 일 단위 갱신 데이터라 KST 날짜가 키에 포함되어
// 날짜가 바뀌면 자동 무효화된다.
let cache = null;
const TTL = 6 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const start = req.query.start || DATA_MIN_DATE;
  const end = req.query.end || kstDateStr(-1);
  if (!YMD.test(start) || !YMD.test(end)) {
    return res.status(400).json({ error: '날짜 형식(YYYY-MM-DD)이 올바르지 않습니다.' });
  }

  const key = `${start}|${end}|${kstDateStr()}`;
  if (cache && cache.key === key && Date.now() - cache.ts < TTL) {
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.json(cache.payload);
  }

  try {
    let bq = createBigQuery();
    // SA에 아직 BigQuery 권한이 없으면 로컬에서는 개발자 gcloud 토큰으로 fallback.
    try {
      await bq.query({ query: 'SELECT 1', location: BQ_LOCATION });
    } catch (authErr) {
      if (isLocalDev() && /permission|access denied/i.test(authErr.message)) {
        console.warn('[shipments] SA 권한 없음 → gcloud 사용자 토큰 fallback (로컬 전용)');
        bq = createBigQueryWithGcloudToken();
      } else {
        throw authErr;
      }
    }
    const run = (query) =>
      bq
        .query({ query, params: { start, end }, location: BQ_LOCATION })
        .then(([rows]) => rows);

    const [byDay, byChannel, byProduct, byProductMonth, byOption] = await Promise.all([
      run(QUERIES.byDay),
      run(QUERIES.byChannel),
      run(QUERIES.byProduct),
      run(QUERIES.byProductMonth),
      run(QUERIES.byOption),
    ]);

    const payload = {
      range: { start, end },
      coverage: { minDate: DATA_MIN_DATE },
      fetchedAt: new Date().toISOString(),
      byDay,
      byChannel,
      byProduct,
      byProductMonth,
      byOption,
    };
    cache = { key, ts: Date.now(), payload };
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.json(payload);
  } catch (err) {
    console.error('[shipments] BigQuery error:', err);
    return res.status(502).json({ error: 'BigQuery 조회 실패: ' + err.message, source: 'bigquery' });
  }
}
