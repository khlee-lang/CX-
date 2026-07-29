import { useEffect, useState } from 'react';

/**
 * localStorage에 값을 유지하는 useState.
 * 최소 출고량 필터처럼 페이지를 옮겨도 유지되어야 하는 조회 설정에 사용한다.
 */
export const useStickyState = <T,>(key: string, initial: T): [T, (v: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 사파리 프라이빗 모드 등 쓰기 실패는 무시 (기능에 영향 없음)
    }
  }, [key, value]);

  return [value, setValue];
};
