// 반품입고시트(판토스_입고리스트) E열("구분") 재계산 스크립트
//
// 원래 E열은 다른 시트(74,539행짜리 [자동]자동화_교환시트연결)를 실시간으로
// 조회하는 거대한 ARRAYFORMULA였는데, 이게 구글 시트 API 응답 지연/타임아웃의
// 원인이었음 (업데이트기록.md 2026-07-06 참고). 그 수식을 이 스크립트로 대체함.
//
// 로직: 반품입고시트의 "입고코드번호"(주문번호+상품명옵션) 열을 정규화한 뒤,
// [자사몰]/[외부몰]/[불량] 교환 접수시트의 "[자동]" 식별자 열(같은 방식으로
// 정규화됨)과 매칭해서 어느 교환 시트에서 왔는지로 "구분" 열 값을 매긴다.
// 못 찾으면 "반품"으로 처리.
//
// 열 위치는 고정 문자(T열/P열/E열)가 아니라 헤더 텍스트로 매번 찾는다 —
// 2026-07-09, "수동구분" 열 삭제로 이후 열이 밀려 조용히 잘못된 열을 읎던
// 사고 이후 도입.
//
// 사용법:
//   node scripts/recompute-category.mjs           # 실제로 구분 열에 씀
//   node scripts/recompute-category.mjs --dry-run  # 계산만 하고 안 씀 (미리보기)
//
// 언제 실행하나: 정해진 주기 없음. 새 반품이 쌓여서 구분값을 다시 매겨야 할 때
// 수동으로 실행. (자동 스케줄 없음 — 구글시트 양식이 바뀔 수 있어 당분간 수동 운영)

import { JWT } from 'google-auth-library';
import { createRequire } from 'module';
import { resolveColumns, indexToLetter } from '../../api/_columns.js';

const EXCHANGE_SS_ID = '1cqLifjcihpHlAUN9ZcG19uJ9MhdkYcOxLzMDPcaBufg';
const RETURNS_SS_ID = '1B6UKmborJQCAKIrIBziAFMjKR0CfY8Jul1E_Rbs5C3Y';
const PENDING_SHEET = '판토스_입고리스트';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TIMEOUT_MS = 25000;

const CATEGORY_SOURCES = [
  { sheet: "'[자사몰] 교환'", label: '자사몰교환' },
  { sheet: "'[외부몰] 교환'", label: '외부몰교환' },
  { sheet: "'[불량] 교환'", label: '불량교환' },
];

function getJwt() {
  let creds;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else {
    const require = createRequire(import.meta.url);
    creds = require('../service-account.json');
  }
  return new JWT({ email: creds.client_email, key: creds.private_key, scopes: SCOPES });
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`응답 없음 (${TIMEOUT_MS / 1000}초 초과)`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(fn, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      console.log(`   (재시도 ${i + 1}/${tries}: ${err.message})`);
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function sheetsGet(jwt, ssId, range) {
  return withRetry(async () => {
    const { token } = await jwt.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values/${encodeURIComponent(range)}`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets GET 오류');
    return data.values || [];
  });
}

async function sheetsPut(jwt, ssId, range, values) {
  return withRetry(async () => {
    const { token } = await jwt.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
    const res = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, values }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets PUT 오류');
    return res.status;
  });
}

// 원래 수식의 REGEXREPLACE(text, "-\d{3}(?:-\d{3})+", "") 와 동일한 정규화
function normalize(s) {
  return (s || '').toString().replace(/-\d{3}(?:-\d{3})+/g, '');
}

// [자동] 식별자 열: 자사몰 시트는 헤더가 정확히 '[자동]', 외부몰 시트는
// '[자동]입고코드번호' — prefix 매칭으로 둘 다 찾음.
// 불량 시트는 이 열에 헤더 이름 자체가 없음(공백) — 이름으로 못 찾으면
// 예전과 같은 고정 위치(P열, 0-based 15)로 대체하고 경고를 남긴다.
const AUTO_ID_FALLBACK_INDEX = 15;

async function buildCategoryMap(jwt) {
  const map = new Map();
  const warnings = [];
  for (const src of CATEGORY_SOURCES) {
    const header = await sheetsGet(jwt, EXCHANGE_SS_ID, `${src.sheet}!1:1`);
    let autoIdCol;
    try {
      autoIdCol = resolveColumns(header[0], { autoId: '[자동]' }, src.sheet, { prefix: true }).autoId;
    } catch (e) {
      autoIdCol = AUTO_ID_FALLBACK_INDEX;
      warnings.push(`${src.sheet}: "[자동]" 식별자 열에 헤더 이름이 없어 P열(고정 위치)로 대체함`);
    }
    const letter = indexToLetter(autoIdCol);
    const pCol = await sheetsGet(jwt, EXCHANGE_SS_ID, `${src.sheet}!${letter}2:${letter}`);
    pCol.forEach(row => {
      const key = normalize(row[0]);
      if (key && !map.has(key)) map.set(key, src.label);
    });
  }
  return { map, warnings };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const jwt = getJwt();

  console.log('1) 교환 접수시트 3개에서 매핑 구축 중...');
  const { map, warnings } = await buildCategoryMap(jwt);
  console.log('   매핑 수:', map.size);
  warnings.forEach(w => console.log('   ⚠️ ' + w));

  console.log('2) 반품입고시트 헤더에서 열 위치 확인 중...');
  const pendingHeader = await sheetsGet(jwt, RETURNS_SS_ID, `'${PENDING_SHEET}'!1:1`);
  const pendingCols = resolveColumns(pendingHeader[0], { arrivalCode: '입고코드번호', category: '구분' }, PENDING_SHEET);
  const arrivalLetter = indexToLetter(pendingCols.arrivalCode);
  const categoryLetter = indexToLetter(pendingCols.category);
  console.log(`   입고코드번호=${arrivalLetter}열, 구분=${categoryLetter}열`);

  console.log('3) 반품입고시트 입고코드번호 열 읾는 중...');
  const tCol = await sheetsGet(jwt, RETURNS_SS_ID, `'${PENDING_SHEET}'!${arrivalLetter}3:${arrivalLetter}`);
  console.log('  ', tCol.length, '행');

  console.log('4) 구분값 계산 중...');
  const newE = tCol.map(row => {
    const t = (row[0] || '').toString();
    if (!t) return [''];
    return [map.get(normalize(t)) || '반품'];
  });

  const dist = {};
  newE.forEach(([v]) => { dist[v || '(빈값)'] = (dist[v || '(빈값)'] || 0) + 1; });
  console.log('   분포:', JSON.stringify(dist));

  if (dryRun) {
    console.log('\n--dry-run 모드라 실제로 쓰지 않았습니다.');
    return;
  }

  console.log('5) 구분 열에 쓰는 중...');
  const range = `'${PENDING_SHEET}'!${categoryLetter}3:${categoryLetter}${2 + newE.length}`;
  const status = await sheetsPut(jwt, RETURNS_SS_ID, range, newE);
  console.log('   결과:', status);

  console.log('6) 검증...');
  const verify = await sheetsGet(jwt, RETURNS_SS_ID, range);
  const okCount = verify.filter((r, i) => (r[0] || '') === newE[i][0]).length;
  console.log(`   ${okCount}/${newE.length} 정확히 반영됨`);
}

main().catch(err => {
  console.error('실패:', err.message);
  process.exit(1);
});
