// 리터니즈 반품업체 엑셀을 프론트에서 파싱/변환한 행들을 받아
// 구글시트 반품입고 스프레드시트의 '리터니즈' 워크시트에 추가하는 API.
//
// 판토스_입고리스트는 그대로 두고(그쪽 자동화/시트 구조는 전혀 건드리지 않음),
// 리터니즈 시트에만 쓴다. 열 위치는 항상 헤더 텍스트로 찾는다(api/_columns.js) —
// 반품입고시트 열 구조가 실시간으로 바뀌는 사고를 겪은 뒤 확립된 이 프로젝트 공용 원칙.

import { JWT } from 'google-auth-library';
import { createRequire } from 'module';
import { resolveColumns, indexToLetter } from './_columns.js';
import { buildCategoryMap, recomputeForSheet } from './recompute-category.js';

const RETURNS_SS_ID = '1B6UKmborJQCAKIrIBziAFMjKR0CfY8Jul1E_Rbs5C3Y';
const RETURNIZE_SHEET = '리터니즈';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const FETCH_TIMEOUT_MS = 20000;

const RETURNIZE_HEADER_SPEC = {
  완료일: '완료일',
  전달일: '전달일',
  구분: '구분',
  판매처: '판매처',
  주문번호: '주문번호',
  성함: '성함',
  연락처: '연락처',
  상품명옵션명: '상품명/옵션명',
  실수량: '실수량',
  아이템순번: '아이템 순번',
  검품제품상태: '검품 제품 상태',
  검품내용물상태: '검품 내용물 상태',
  훼손사유: '훼손 사유',
  배송비동봉여부: '배송비 동봉여부',
  반송장번호: '반송장번호',
  입고코드번호: '입고코드번호',
};

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
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const res = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, values }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets PUT 오류');
    return data;
  });
}

async function sheetsGetMetadata(jwt, ssId, fields) {
  return withRetry(async () => {
    const { token } = await getAccessTokenWithTimeout(jwt);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}?fields=${encodeURIComponent(fields)}`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets 메타데이터 조회 오류');
    return data;
  });
}

async function sheetsBatchUpdate(jwt, ssId, requests) {
  return withRetry(async () => {
    const { token } = await getAccessTokenWithTimeout(jwt);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}:batchUpdate`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Sheets batchUpdate 오류');
    return data;
  });
}

// 업로드할 행 수가 시트의 실제 그리드 크기(물리적 행 개수)를 넘어서면
// values.update(PUT)이 "Range exceeds grid limits" 오류를 낸다. 쓰기 전에
// 필요한 만큼(+여유분) 그리드 행 수를 늘리고, 그리드 끝까지 걸려있던 조건부서식
// (구분값 색칠, "훼손" 색칠 등)도 새 그리드 끝까지 같이 늘려서
// 새로 추가되는 행에도 서식이 그대로 적용되게 한다.
const GRID_GROWTH_BUFFER = 500;

async function ensureGridCapacity(jwt, ssId, sheetName, requiredLastRow) {
  const meta = await sheetsGetMetadata(jwt, ssId, 'sheets(properties,conditionalFormats)');
  const sheet = meta.sheets?.find(s => s.properties?.title === sheetName);
  if (!sheet) throw new Error(`'${sheetName}' 시트를 찾을 수 없습니다.`);

  const sheetId = sheet.properties.sheetId;
  const currentRowCount = sheet.properties.gridProperties?.rowCount ?? 0;
  if (requiredLastRow <= currentRowCount) return;

  const newRowCount = requiredLastRow + GRID_GROWTH_BUFFER;
  const requests = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { rowCount: newRowCount } },
        fields: 'gridProperties.rowCount',
      },
    },
  ];

  (sheet.conditionalFormats || []).forEach((cf, index) => {
    const extendedRanges = cf.ranges.map(r => (
      r.sheetId === sheetId && r.endRowIndex === currentRowCount
        ? { ...r, endRowIndex: newRowCount }
        : r
    ));
    const changed = extendedRanges.some((r, i) => r.endRowIndex !== cf.ranges[i].endRowIndex);
    if (changed) {
      requests.push({
        updateConditionalFormatRule: {
          sheetId,
          index,
          rule: { ...cf, ranges: extendedRanges },
        },
      });
    }
  });

  await sheetsBatchUpdate(jwt, ssId, requests);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: '반영할 행이 없습니다.' });
  }

  try {
    const jwt = getJwt();

    const header = await sheetsGet(jwt, RETURNS_SS_ID, `'${RETURNIZE_SHEET}'!1:1`);
    if (!header[0]) throw new Error(`'${RETURNIZE_SHEET}' 시트의 헤더 행을 읽을 수 없습니다.`);
    const cols = resolveColumns(header[0], RETURNIZE_HEADER_SPEC, RETURNIZE_SHEET);
    const colCount = header[0].length;

    const orderLetter = indexToLetter(cols.주문번호);
    const itemLetter = indexToLetter(cols.상품명옵션명);

    // 현재 데이터가 몇 행까지 차 있는지 확인 (주문번호 열 기준 — 항상 채워지는 값)
    const existing = await sheetsGet(jwt, RETURNS_SS_ID, `'${RETURNIZE_SHEET}'!${orderLetter}2:${orderLetter}`);
    const startRow = 2 + existing.length;

    const values = rows.map((row, i) => {
      const rowNum = startRow + i;
      const arr = new Array(colCount).fill('');
      for (const [key, idx] of Object.entries(cols)) {
        if (key === '입고코드번호') continue; // 아래에서 수식으로 채움
        arr[idx] = row[key] ?? '';
      }
      arr[cols.입고코드번호] = `=${orderLetter}${rowNum}&${itemLetter}${rowNum}`;
      return arr;
    });

    const lastRow = startRow + values.length - 1;
    await ensureGridCapacity(jwt, RETURNS_SS_ID, RETURNIZE_SHEET, lastRow);

    const lastColLetter = indexToLetter(colCount - 1);
    const range = `'${RETURNIZE_SHEET}'!A${startRow}:${lastColLetter}${lastRow}`;
    await sheetsPut(jwt, RETURNS_SS_ID, range, values);

    // 새로 넣은 행들의 '구분'(자사몰교환/외부몰교환/불량교환/반품)을 바로 채운다 —
    // recompute-category.js의 로직을 그대로 재사용(리터니즈 시트, 데이터 2행부터).
    let category = null;
    try {
      const { map } = await buildCategoryMap(jwt);
      const result = await recomputeForSheet(jwt, map, RETURNIZE_SHEET, 2, true);
      category = { rowCount: result.rowCount, distribution: result.distribution };
    } catch (catErr) {
      console.error('[upload-returnize] 구분 자동계산 실패 — 행은 정상 삽입됨, 구분은 반품 시트 관리에서 수동 재계산 필요', catErr);
    }

    res.json({ insertedCount: values.length, startRow, category });
  } catch (err) {
    console.error('[upload-returnize]', err);
    res.status(500).json({ error: err.message });
  }
}
