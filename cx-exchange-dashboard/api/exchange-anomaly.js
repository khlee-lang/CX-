import { randomUUID } from 'crypto';
import {
  createBigQuery,
  createBigQueryWithGcloudToken,
  isLocalDev,
  ANOMALY_EVENTS_TABLE,
  BQ_LOCATION,
} from './_bigquery.js';

// 관제 그래프 밴드초과 이벤트 로그 — 드릴다운 모달에서 사용자가 수동으로
// "기록"을 눌렀을 때만 저장된다(자동 기록 아님, 사용자 확인).
// 날짜/타임스탬프 열은 명시적으로 STRING 캐스팅한다 — 안 하면 BigQuery 클라이언트
// 라이브러리가 { value: "..." } 래퍼 객체로 반환해 프론트에서 바로 못 쓴다.
const LIST_QUERY = `
  SELECT event_id, CAST(detected_at AS STRING) AS detected_at,
         CAST(bucket_start AS STRING) AS bucket_start, CAST(bucket_end AS STRING) AS bucket_end,
         granularity, channel_group AS channelGroup, rate, band_mean AS bandMean,
         band_upper AS bandUpper, band_lower AS bandLower, memo
  FROM ${ANOMALY_EVENTS_TABLE}
  ORDER BY detected_at DESC
  LIMIT @limit
`;

const INSERT_QUERY = `
  INSERT INTO ${ANOMALY_EVENTS_TABLE}
    (event_id, detected_at, bucket_start, bucket_end, granularity, channel_group, rate, band_mean, band_upper, band_lower, memo)
  VALUES
    (@eventId, CURRENT_TIMESTAMP(), @bucketStart, @bucketEnd, @granularity, @channelGroup, @rate, @bandMean, @bandUpper, @bandLower, @memo)
`;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

async function getBigQuery() {
  let bq = createBigQuery();
  try {
    await bq.query({ query: 'SELECT 1', location: BQ_LOCATION });
  } catch (authErr) {
    if (isLocalDev() && /permission|access denied/i.test(authErr.message)) {
      console.warn('[exchange-anomaly] SA 권한 없음 → gcloud 사용자 토큰 fallback (로컬 전용)');
      bq = createBigQueryWithGcloudToken();
    } else {
      throw authErr;
    }
  }
  return bq;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
      const bq = await getBigQuery();
      const [rows] = await bq.query({ query: LIST_QUERY, params: { limit }, location: BQ_LOCATION });
      return res.json({ events: rows });
    }

    if (req.method === 'POST') {
      const { bucketStart, bucketEnd, granularity, channelGroup, rate, bandMean, bandUpper, bandLower, memo } = req.body || {};
      if (!YMD.test(bucketStart || '') || !YMD.test(bucketEnd || '')) {
        return res.status(400).json({ error: '날짜 형식(YYYY-MM-DD)이 올바르지 않습니다.' });
      }
      if (!['day', 'week', 'month'].includes(granularity)) {
        return res.status(400).json({ error: 'granularity는 day/week/month여야 합니다.' });
      }
      if (channelGroup !== 'jasa' && channelGroup !== 'oebu') {
        return res.status(400).json({ error: 'channelGroup은 jasa 또는 oebu여야 합니다.' });
      }
      if (!memo || !memo.trim()) {
        return res.status(400).json({ error: '메모를 입력해야 기록할 수 있습니다.' });
      }

      const bq = await getBigQuery();
      const eventId = randomUUID();
      await bq.query({
        query: INSERT_QUERY,
        params: {
          eventId,
          bucketStart,
          bucketEnd,
          granularity,
          channelGroup,
          rate: rate ?? null,
          bandMean: bandMean ?? null,
          bandUpper: bandUpper ?? null,
          bandLower: bandLower ?? null,
          memo: memo.trim(),
        },
        location: BQ_LOCATION,
      });
      return res.json({ eventId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[exchange-anomaly] BigQuery error:', err);
    return res.status(502).json({ error: 'BigQuery 처리 실패: ' + err.message, source: 'bigquery' });
  }
}
