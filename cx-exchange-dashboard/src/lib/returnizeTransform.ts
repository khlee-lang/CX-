// 리터니즈 반품업체 엑셀("주문 조회 결과") → 리터니즈 워크시트 행 변환 유틸.
// 순수 함수로 분리해서 브라우저에서 업로드 즉시 미리보기에 쓸 수 있게 한다.

export interface ReturnizeSourceRow {
  브랜드주문번호: string;
  고객명: string;
  연락처: string;
  접수채널명: string;
  주문번호: string;
  상품명: string;
  옵션: string;
  송장번호: string;
  아이템순번: string | number;
  상태: string; // 검품완료 / 검품중
  검품제품상태: string;
  검품내용물상태: string;
  훼손사유: string;
  수량: string | number;
}

export type RowStatus = 'ok' | 'needsReview' | 'excluded';

export interface ReturnizeRow {
  status: RowStatus;
  // 리터니즈 워크시트 컬럼
  완료일: string;
  전달일: string;
  구분: string;
  판매처: string;
  주문번호: string;
  성함: string;
  연락처: string;
  상품명옵션명: string;
  실수량: string | number;
  아이템순번: string | number;
  검품제품상태: string;
  검품내용물상태: string;
  훼손사유: string;
  배송비동봉여부: string;
  반송장번호: string;
  // 원본 참고용(확인필요 화면 표시용)
  원본상품명: string;
  원본옵션: string;
  excludeReason?: string;
}

const CHANNEL_MAP: Record<string, string> = {
  'CAFE24': '카페24(신)',
  '카페24': '카페24(신)',
  '네이버': '스마트스토어',
  'CAFE24_네이버페이': '네이버페이',
};

export function mapChannel(channel: string): string {
  const trimmed = (channel || '').trim();
  return CHANNEL_MAP[trimmed] || trimmed;
}

export function stripOrderSuffix(brandOrderNo: string): string {
  return (brandOrderNo || '').trim().replace(/_\d+$/, '');
}

// 옵션 문자열 형태 두 가지를 자동 조합 대상으로 인정한다:
// 1) "제품코드 | 색상 | 사이즈" 정확히 3파트 (파이프 구분)
// 2) 파이프 없이 "색상-사이즈" 형태 (예: "라이트블루- S", "블랙-S")
// 그 외 형태(옵션 없음, 파트 개수가 안 맞음 등)는 null을 반환해서 "확인필요"로 분류하게 한다.
export function buildItemOption(productName: string, option: string): string | null {
  const raw = (option || '').trim();
  if (!raw) return null;
  const name = (productName || '').trim();

  const pipeParts = raw.split('|').map(p => p.trim()).filter(p => p.length > 0);
  if (pipeParts.length === 3) {
    const [, color, size] = pipeParts;
    return `${name}[${color}-${size}]`;
  }

  if (!raw.includes('|')) {
    const dashParts = raw.split('-').map(p => p.trim()).filter(p => p.length > 0);
    if (dashParts.length === 2) {
      const [color, size] = dashParts;
      return `${name}[${color}-${size}]`;
    }
  }

  return null;
}

// 검품 제품 상태가 이 값이면 반품 자체가 잘못 온 것(제품 없음)이거나 아예 다른
// 브랜드 물건(타사 제품)이라 리터니즈 시트로 이관하지 않는다.
// '본품 틀림'(물건은 왔지만 신청과 다름)은 그대로 이관하되, 검품 제품 상태 값이
// 그대로 시트의 "검품 제품 상태" 열에 기재되어 CX 담당자가 구분할 수 있게 한다.
const EXCLUDED_INSPECTION_STATUSES = ['제품 없음', '타사 제품'];

export function transformReturnizeRows(sourceRows: ReturnizeSourceRow[], today: Date): ReturnizeRow[] {
  const 전달일 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return sourceRows
    .filter(r => (r.상태 || '').trim() === '검품완료')
    .filter(r => !EXCLUDED_INSPECTION_STATUSES.includes((r.검품제품상태 || '').trim()))
    .map(r => {
      const combined = buildItemOption(r.상품명, r.옵션);
      const status: RowStatus = combined === null ? 'needsReview' : 'ok';

      return {
        status,
        완료일: '',
        전달일,
        구분: '',
        판매처: mapChannel(r.접수채널명),
        주문번호: stripOrderSuffix(r.브랜드주문번호),
        성함: (r.고객명 || '').trim(),
        연락처: (r.연락처 || '').trim(),
        상품명옵션명: combined ?? '',
        실수량: r.수량,
        아이템순번: r.아이템순번,
        검품제품상태: (r.검품제품상태 || '').trim(),
        검품내용물상태: (r.검품내용물상태 || '').trim(),
        훼손사유: (r.훼손사유 || '').trim(),
        배송비동봉여부: '',
        반송장번호: (r.송장번호 || '').trim(),
        원본상품명: (r.상품명 || '').trim(),
        원본옵션: (r.옵션 || '').trim(),
      };
    });
}
