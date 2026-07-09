// 반품입고시트(판토스_입고리스트) E열("구분") 재계산 API
//
// 원래 E열은 다른 시트(74,539행짜리 [자동]자동화_교환시트연결)를 실시간으로
// 조회하는 거대한 ARRAYFORMULA였는데, 이게 구글 시트 API 응답 지연/타임아웃의
// 원인이었음 (업데이트기록.md 2026-07-06 참고). 그 수식을 이 함수로 대체함.
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
// POST { apply: false } → 미리보기(분포만 계산, 시트에 안 씀)
// POST { apply: true }  → 실제로 구분 열에 씀

import { JWT } from 'google-auth-library';
import { createRequire } from 'module';
import { resolveColumns, indexToLetter } from './_columns.js';

const EXCHANGE_SS_ID = '1cqLifjcihpHlAUN9ZcG19uJ9MhdkYcOxLzMDPcaBufg';
const RETURNS_SS_ID = '1B6UKmborJQCAKIrIBziAFMjKR0CfY8Jul1E_Rbs5C3Y';
const PENDING_SHEET = '판토스_입고리스트';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const FETCH_TIMEOUT_MS = 20000;

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
    creds = require('../server/service-account.json');
  }
  return new JWT({ email: creds.client_email, key: creds.private_key, scopes: SCOPES });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getAccessTokenWithTimeout(jwt) {
  return Promise.race([
    jwt.getAccessToken(),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`토큰 발급 응답 없음 (${FETCH_TIMEOUT_MS / 1000}초 초과)`)), FETCH_TIMEOUT_MS)),
  ]);
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Sheets API 응답 없음 (${FETCH_TIMEOUT_MS / 1000}초 초과)`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(fn, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const transient = /unavailable|internal error|rate limit|timeout|응답 없음/i.test(err.message || '');
      if (!transient || i === tries - 1) throw err;
      await sleep(1000 * (i + 1));
    }
  }
  throw lastErr;
}

async function sheetsGet(jwt, ssId, range) {
  return withRetry(async () => {
    const { token } = await getAccessTokenWithTimeout(jwt);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values/${encodeURIComponent(range)}`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets GET 오류');
    return data.values || [];
  });
}

async function sheetsPut(jwt, ssId, range, values) {
  return withRetry(async () => {
    const { token } = await getAccessTokenWithTimeout(jwt);
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
      warnings.push(`${src.sheet}: "[자동]" 식별자 열에 헤더 이름이 없어 P열(고정 위치)로 대체함 — 열 구성이 바뀌면 틀릴 수 있음`);
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apply = false } = req.body || {};

  try {
    const jwt = getJwt();

    const { map, warnings } = await buildCategoryMap(jwt);

    const pendingHeader = await sheetsGet(jwt, RETURNS_SS_ID, `'${PENDING_SHEET}'!1:1`);
    const pendingCols = resolveColumns(pendingHeader[0], { arrivalCode: '입고코드번호', category: '구분' }, PENDING_SHEET);
    const arrivalLetter = indexToLetter(pendingCols.arrivalCode);
    const categoryLetter = indexToLetter(pendingCols.category);

    const tCol = await sheetsGet(jwt, RETURNS_SS_ID, `'${PENDING_SHEET}'!${arrivalLetter}3:${arrivalLetter}`);
    const newE = tCol.map(row => {
      const t = (row[0] || '').toString();
      if (!t) return [''];
      return [map.get(normalize(t)) || '반품'];
    });

    const distribution = {};
    newE.forEach(([v]) => { distribution[v || '(빈값)'] = (distribution[v || '(빈값)'] || 0) + 1; });

    let applied = false;
    if (apply && newE.length > 0) {
      const range = `'${PENDING_SHEET}'!${categoryLetter}3:${categoryLetter}${2 + newE.length}`;
      await sheetsPut(jwt, RETURNS_SS_ID, range, newE);
      applied = true;
    }

    res.json({ rowCount: newE.length, distribution, applied, warnings });
  } catch (err) {
    console.error('[recompute-category]', err);
    res.status(500).json({ error: err.message });
  }
}
