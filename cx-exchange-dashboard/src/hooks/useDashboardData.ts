import { useCallback, useEffect, useState } from 'react';
import { fetchDashboardData, type ExchangeData } from '../api/sheets';

type RangeSource = 'jasaMall' | 'oebuMall' | 'bulryang' | 'all';

export interface UseDashboardDataResult {
  data: ExchangeData | null;
  loading: boolean;
  reload: (force?: boolean) => Promise<void>;
  startDate: string;
  endDate: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  /** 새로고침 버튼 클릭 횟수 — useShipments 강제 재조회 키로 사용 */
  reloadKey: number;
}

/**
 * 5개 분석 페이지에서 반복되던 로딩 + 기본 기간(최신 접수일 − 1개월) 로직 통합.
 */
export const useDashboardData = (rangeSource: RangeSource = 'all'): UseDashboardDataResult => {
  const [data, setData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        const result = await fetchDashboardData(force);
        setData(result);

        // 기본 기간: 대상 시트의 최신 접수일 기준 최근 1개월
        setStartDate((prevStart) => {
          if (prevStart) return prevStart;
          const sources =
            rangeSource === 'all'
              ? [result.data.jasaMall, result.data.oebuMall, result.data.bulryang]
              : [result.data[rangeSource]];
          const allDates: string[] = [];
          sources.forEach((arr: Record<string, string>[]) => {
            (arr || []).forEach((row) => {
              if (row['접수일']) allDates.push(row['접수일'].replace(/\./g, '-'));
            });
          });
          if (allDates.length === 0) return prevStart;
          allDates.sort();
          const maxDateStr = allDates[allDates.length - 1];
          const start = new Date(maxDateStr);
          start.setMonth(start.getMonth() - 1);
          setEndDate((prevEnd) => prevEnd || maxDateStr);
          return start.toISOString().split('T')[0];
        });
      } catch (err) {
        console.error(err instanceof Error ? err.message : err);
      } finally {
        setLoading(false);
      }
    },
    [rangeSource],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = useCallback(
    async (force = true) => {
      setReloadKey((k) => k + 1);
      await load(force);
    },
    [load],
  );

  return { data, loading, reload, startDate, endDate, setStartDate, setEndDate, reloadKey };
};
