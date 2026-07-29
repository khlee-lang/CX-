import { BigQuery } from '@google-cloud/bigquery';
import { OAuth2Client } from 'google-auth-library';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';

// 출고 데이터 테이블 (verish-pm 프로젝트, 조회 권한은 cx-part SA에 이미 부여됨)
export const SHIPMENT_TABLE = '`verish-pm.cx.daily_channel_sku_stockout`';
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
