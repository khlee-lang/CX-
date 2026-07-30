import { useEffect, useState } from 'react';
import { fetchExchangeHistory, type ExchangeHistoryData } from '../api/exchangeHistory';

export const useExchangeHistory = () => {
  const [data, setData] = useState<ExchangeHistoryData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const result = await fetchExchangeHistory();
      if (cancelled) return;
      setData(result);
      setFailed(result === null);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { exchangeHistory: data, failed };
};
