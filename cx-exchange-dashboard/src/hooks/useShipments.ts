import { useEffect, useMemo, useState } from 'react';
import { fetchShipments, type ShipmentData } from '../api/shipments';
import { buildShipmentIndex, type ShipmentIndex } from '../lib/rate';

export interface UseShipmentsResult {
  shipments: ShipmentData | null;
  /** null = 로딩 중 or 실패. 실패 여부는 failed로 구분 */
  index: ShipmentIndex | null;
  loading: boolean;
  /** true = 조회 실패 → 교환율 지표 숨기고 안내 배너 표시 */
  failed: boolean;
}

/**
 * 기간에 해당하는 출고 데이터 + 조인 인덱스.
 * start/end가 아직 비어있으면(기본 기간 계산 전) 조회하지 않는다.
 */
export const useShipments = (start?: string, end?: string, reloadKey = 0): UseShipmentsResult => {
  const [shipments, setShipments] = useState<ShipmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!start || !end) return;
    let cancelled = false;
    // setState는 async 함수 안에서만 호출한다 — effect 본문에서 동기로 부르면
    // 연쇄 렌더링이 발생한다(react-hooks 규칙).
    const run = async () => {
      setLoading(true);
      const data = await fetchShipments(start, end, reloadKey > 0);
      if (cancelled) return;
      setShipments(data);
      setFailed(data === null);
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [start, end, reloadKey]);

  const index = useMemo(() => (shipments ? buildShipmentIndex(shipments) : null), [shipments]);

  return { shipments, index, loading, failed };
};
