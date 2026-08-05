import {
  createBigQuery,
  createBigQueryWithGcloudToken,
  isLocalDev,
  SHIPMENT_TABLE,
  HISTORICAL_SHIPMENT_TABLE,
  HISTORICAL_DATA_MIN_DATE,
  BQ_LOCATION,
} from './_bigquery.js';

// 국내-B2C 출고량 집계. 자사몰 = 카페24(신), 외부몰 = 그 외 국내-B2C.
// CS(딥다이브)는 교환출고 채널이라 교환율 분모에서 제외.
//
// 판토스 전환일(2026-03-02)을 걸치는 조회를 위해 라이브 테이블과 과거(이지어드민/
// 한솔물류) 테이블을 UNION ALL 한다. 각 서브쿼리에 동일한 날짜 필터를 걸어두면
// 조회 기간이 한쪽 테이블 범위에만 있을 때는 다른 쪽이 자연히 빈 결과가 된다.
const ROW_SELECT = `
  wms_out_confirm_date AS d,
  sales_channel,
  IF(sales_channel = '카페24(신)', 'jasa', 'oebu') AS channel_group,
  name, category1, color, size,
  stockout_cnt
`;
const DATE_FILTER = `
  channel_status = '국내-B2C'
  AND sales_channel != 'CS(딥다이브)'
  AND wms_out_confirm_date BETWEEN @start AND @end
`;
const BASE_CTE = `
  WITH base AS (
    SELECT ${ROW_SELECT} FROM ${SHIPMENT_TABLE} WHERE ${DATE_FILTER}
    UNION ALL
    SELECT ${ROW_SELECT} FROM ${HISTORICAL_SHIPMENT_TABLE} WHERE ${DATE_FILTER}
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
  // 세일즈 뷰(주차별 SKU 교환율) 전용 — ?weekly=1일 때만 조회.
  // 주 시작 = 월요일 (프론트 controlChart/salesView의 주 버킷과 동일 기준).
  byProductWeek: `${BASE_CTE}
    SELECT CAST(DATE_TRUNC(d, WEEK(MONDAY)) AS STRING) AS week, name,
           channel_group AS channelGroup, SUM(stockout_cnt) AS qty
    FROM base GROUP BY 1, 2, 3`,
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DATA_MIN_DATE = HISTORICAL_DATA_MIN_DATE;
// 판토스 전환 이지어드민/한솔물류 데이터 사이 실제 공백 구간(자료 없음, 이틀).
const COVERAGE_GAP = { start: '2026-02-28', end: '2026-03-01' };

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
  // 주차×상품 집계는 세일즈 뷰만 쓰므로 opt-in — 기존 페이지 응답을 안 불린다.
  const weekly = req.query.weekly === '1';

  const key = `${start}|${end}|${weekly ? 'w' : ''}|${kstDateStr()}`;
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

    const [byDay, byChannel, byProduct, byProductMonth, byOption, byProductWeek] = await Promise.all([
      run(QUERIES.byDay),
      run(QUERIES.byChannel),
      run(QUERIES.byProduct),
      run(QUERIES.byProductMonth),
      run(QUERIES.byOption),
      weekly ? run(QUERIES.byProductWeek) : Promise.resolve(undefined),
    ]);

    const payload = {
      range: { start, end },
      coverage: { minDate: DATA_MIN_DATE, gap: COVERAGE_GAP },
      fetchedAt: new Date().toISOString(),
      byDay,
      byChannel,
      byProduct,
      byProductMonth,
      byOption,
      ...(weekly ? { byProductWeek } : {}),
    };
    cache = { key, ts: Date.now(), payload };
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.json(payload);
  } catch (err) {
    console.error('[shipments] BigQuery error:', err);
    return res.status(502).json({ error: 'BigQuery 조회 실패: ' + err.message, source: 'bigquery' });
  }
}
