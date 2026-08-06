import {
  createBigQuery,
  createBigQueryWithGcloudToken,
  isLocalDev,
  HISTORICAL_EXCHANGE_TABLE,
  BQ_LOCATION,
} from './_bigquery.js';
import detailHandler from './_exchange-history-detail.js';
import anomalyHandler from './_exchange-anomaly.js';

// 옛날 교환접수(2024-05-28~2026-01-06) 일별×채널그룹 건수.
// 라이브 기간(2026-05-04~)의 교환건수는 구글시트(dashboard-data)에서 오므로
// 프론트에서 이 응답과 합쳐 하나의 시계열로 만든다.
const QUERY = `
  SELECT
    CAST(receipt_date AS STRING) AS date,
    channel_group AS channelGroup,
    COUNT(*) AS exchangeCnt,
    COUNTIF(is_defect) AS defectCnt
  FROM ${HISTORICAL_EXCHANGE_TABLE}
  WHERE receipt_date BETWEEN @start AND @end
  GROUP BY 1, 2
  ORDER BY 1
`;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const EXCHANGE_HISTORY_MIN_DATE = '2024-05-28';
// 테이블 실제 최대 접수일. 예전엔 '2026-01-06'으로 막아뒀는데, 그 뒤로 2026-2~3Q 시트가
// 아카이브되면서 05-29까지 쌓였다. 상한을 안 올리면 2026-04~05 교환건이 통째로 누락돼
// 교환율이 과소 집계된다(2026-05 자사몰 2,595건 누락 상태였음).
// 라이브 시트와 기간이 겹치지만 주문번호 대조 결과 서로 다른 건이라(공통 1건) 합산해도 이중 집계가 아니다
// — 처리 완료분이 이관·아카이브되어 라이브 시트에서 빠지는 구조.
export const EXCHANGE_HISTORY_MAX_DATE = '2026-05-29';

// 이 데이터는 원본 시트가 더 이상 안 바뀌는 한 완전히 고정이라 캐시를 길게 둔다.
let cache = null;
const TTL = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  // Vercel Hobby 플랜 함수 12개 제한 → 드릴다운·이상 이벤트 로그를
  // 이 함수 하나에 합치고 ?resource= 로 분기한다 (기본값: 히스토리 목록).
  if (req.query.resource === 'detail') return detailHandler(req, res);
  if (req.query.resource === 'anomaly') return anomalyHandler(req, res);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const start = req.query.start || EXCHANGE_HISTORY_MIN_DATE;
  const end = req.query.end || EXCHANGE_HISTORY_MAX_DATE;
  if (!YMD.test(start) || !YMD.test(end)) {
    return res.status(400).json({ error: '날짜 형식(YYYY-MM-DD)이 올바르지 않습니다.' });
  }

  const key = `${start}|${end}`;
  if (cache && cache.key === key && Date.now() - cache.ts < TTL) {
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.json(cache.payload);
  }

  try {
    let bq = createBigQuery();
    try {
      await bq.query({ query: 'SELECT 1', location: BQ_LOCATION });
    } catch (authErr) {
      if (isLocalDev() && /permission|access denied/i.test(authErr.message)) {
        console.warn('[exchange-history] SA 권한 없음 → gcloud 사용자 토큰 fallback (로컬 전용)');
        bq = createBigQueryWithGcloudToken();
      } else {
        throw authErr;
      }
    }
    const [byDay] = await bq
      .query({ query: QUERY, params: { start, end }, location: BQ_LOCATION })
      .then(([rows]) => [rows]);

    const payload = {
      range: { start, end },
      coverage: { minDate: EXCHANGE_HISTORY_MIN_DATE, maxDate: EXCHANGE_HISTORY_MAX_DATE },
      fetchedAt: new Date().toISOString(),
      byDay,
    };
    cache = { key, ts: Date.now(), payload };
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.json(payload);
  } catch (err) {
    console.error('[exchange-history] BigQuery error:', err);
    return res.status(502).json({ error: 'BigQuery 조회 실패: ' + err.message, source: 'bigquery' });
  }
}
