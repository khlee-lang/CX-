import { BigQuery } from '@google-cloud/bigquery';
import { OAuth2Client } from 'google-auth-library';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';

// 출고 데이터 테이블 (verish-pm 프로젝트, 조회 권한은 cx-part SA에 이미 부여됨)
// 판토스 전환(2026-03-02) 이후 실시간 데이터.
export const SHIPMENT_TABLE = '`verish-pm.cx.daily_channel_sku_stockout`';
// 판토스 전환 이전(이지어드민/한솔물류) 출고 히스토리, 2024-05-02~2026-02-27.
// 2026-07-29 강희님이 원본 CSV를 집계해 업로드. cx 데이터셋 단위 권한이라 SA가 바로 읽을 수 있음.
export const HISTORICAL_SHIPMENT_TABLE = '`verish-pm.cx.daily_channel_sku_stockout_historical`';
export const HISTORICAL_DATA_MIN_DATE = '2024-05-02';
// 옛날 교환접수 시트(시트1/2/3) dedup 통합본, 2024-05-28~2026-01-06.
// 개인정보(수령자/연락처/우편번호/주소)는 제외 — 2026-07-29 통합, 강희님 업로드.
export const HISTORICAL_EXCHANGE_TABLE = '`verish-pm.cx.exchange_historical`';
export const BQ_LOCATION = 'asia-northeast3';

function getCreds() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  const require = createRequire(import.meta.url);
  return require('../server/service-account.json');
}

export function createBigQuery() {
  const creds = getCreds();
  return new BigQuery({
    // job 실행(과금) 프로젝트는 SA 소속 프로젝트(verish-part), 테이블은 크로스 프로젝트 조회
    projectId: creds.project_id,
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
  });
}

// 로컬 개발 전용 fallback: SA에 BigQuery 권한이 부여되기 전까지
// 개발자 본인의 gcloud 사용자 토큰으로 쿼리한다. Vercel에서는 절대 실행되지 않음.
export function createBigQueryWithGcloudToken() {
  const token = execFileSync('gcloud', ['auth', 'print-access-token'], {
    encoding: 'utf8',
  }).trim();
  const authClient = new OAuth2Client();
  authClient.setCredentials({ access_token: token });
  return new BigQuery({ projectId: 'verish-pm', authClient });
}

export const isLocalDev = () => !process.env.VERCEL;
