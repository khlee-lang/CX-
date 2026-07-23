// 리터니즈 워크시트 구분열 재계산 API — 판토스_입고리스트용 recompute-category.js와
// 판단 로직은 동일하지만(buildCategoryMap/recomputeForSheet 재사용), 리터니즈 시트만
// 독립적으로 다시 계산할 수 있도록 별도 엔드포인트로 분리했다.
// 원래는 리터니즈 업로드 시에만 자동 실행됐는데, 업로드 없이도(예: 교환접수시트
// 쪽 데이터가 나중에 바뀌었거나, [자동] 식별자 열이 뒤늦게 복구된 경우 등)
// 필요할 때 다시 계산할 수 있는 버튼이 없어서 추가함(2026-07-15).
//
// POST { apply: false } → 미리보기(분포만 계산, 시트에 안 씀)
// POST { apply: true }  → 실제로 구분 열에 씀

import { createRequire } from 'module';
import { JWT } from 'google-auth-library';
import { buildCategoryMap, recomputeForSheet } from './recompute-category.js';

const RETURNIZE_SHEET = '리터니즈';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function getJwt() {
  let creds;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else {
    const require = createRequire(import.meta.url);
    creds = require('../server/service-account.json');
  }
  return new JWT({ email: creds.client_email, key: creds.private_key, scopes: SCOPES });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apply = false } = req.body || {};

  try {
    const jwt = getJwt();

    const { map, warnings } = await buildCategoryMap(jwt);
    const result = await recomputeForSheet(jwt, map, RETURNIZE_SHEET, 2, apply);

    res.json({ rowCount: result.rowCount, distribution: result.distribution, applied: result.applied, warnings });
  } catch (err) {
    console.error('[recompute-returnize]', err);
    res.status(500).json({ error: err.message });
  }
}
