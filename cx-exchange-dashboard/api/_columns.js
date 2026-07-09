// 구글시트 열 위치를 헤더 텍스트로 찾는 공용 유틸.
//
// 배경: 반품입고시트에서 "수동구분" 열이 삭제되자 그 뒤 모든 열이 한 칸씩 밀렸는데,
// reconcile.js 등이 열을 고정된 숫자/문자(J열, T열...)로 하드코딩해서 조용히
// 엉뚱한 데이터(주문번호 대신 고객 이름 등)를 읽고 있었음(2026-07-09 발견).
// 앞으로는 시트가 또 바뀌어도 헤더 글자만 같으면 코드가 알아서 위치를 찾고,
// 헤더를 못 찾으면 조용히 넘어가지 않고 에러를 던져서 바로 눈에 띄게 한다.

// headerRow: 헤더 행 배열 (예: ['상태값','판토스 전달 내용',...])
// spec: { 키: '찾을 헤더 텍스트' } 형태
// 반환: { 키: 0-based 인덱스 }
// opts.prefix: true면 정확히 일치하는 헤더가 없을 때 "그 텍스트로 시작하는" 헤더도 인정
// (예: 자사몰 시트는 헤더가 정확히 '[자동]', 외부몰 시트는 '[자동]입고코드번호' —
// 같은 역할인데 이름이 달라서 prefix 매칭이 필요함)
export function resolveColumns(headerRow, spec, sheetLabel = '', opts = {}) {
  const trimmed = (headerRow || []).map(h => (h || '').toString().trim());
  const result = {};
  const missing = [];
  for (const [key, name] of Object.entries(spec)) {
    let idx = trimmed.indexOf(name);
    if (idx === -1 && opts.prefix) {
      idx = trimmed.findIndex(h => h.startsWith(name));
    }
    if (idx === -1) missing.push(name);
    else result[key] = idx;
  }
  if (missing.length > 0) {
    throw new Error(
      `${sheetLabel ? `[${sheetLabel}] ` : ''}시트 헤더에서 다음 열을 찾을 수 없습니다: ${missing.join(', ')} — 시트 열 구성이 바뀌었는지 확인해주세요. (현재 헤더: ${trimmed.join(', ')})`
    );
  }
  return result;
}

// 0-based 열 인덱스를 A1 표기 문자로 변환 (0→A, 1→B, ...)
export function indexToLetter(idx0based) {
  let col = idx0based + 1;
  let s = '';
  while (col > 0) {
    s = String.fromCharCode(64 + (col % 26 || 26)) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
