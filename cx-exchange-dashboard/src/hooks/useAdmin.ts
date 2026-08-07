import { useCallback, useEffect, useState } from 'react';
import { verifyAdminKey } from '../api/feedback';

// SALES 수정요청 시스템과 같은 localStorage 키를 공유한다 —
// 한 번 관리자 키를 넣으면 홈/프로젝트/SALES 어디서든 관리자로 인식.
const ADMIN_KEY_KEY = 'cx.feedback.adminKey';

interface AdminState {
  /** 서버 검증까지 통과한 관리자 여부 */
  isAdmin: boolean;
  /** 검증 진행 중 (저장된 키가 있어 확인하는 동안 true) */
  checking: boolean;
  adminKey: string;
  /** 키 입력 → 서버 검증 → 성공 시 저장. 반환값 = 성공 여부 */
  login: (key: string) => Promise<boolean>;
  logout: () => void;
}

export const useAdmin = (): AdminState => {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(ADMIN_KEY_KEY) || '');
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(() => !!localStorage.getItem(ADMIN_KEY_KEY));

  // 저장된 키 자동 검증 (서버 검증이라 키만 안다고 우회 불가)
  useEffect(() => {
    if (!adminKey) { setIsAdmin(false); setChecking(false); return; }
    let cancelled = false;
    setChecking(true);
    void verifyAdminKey(adminKey).then((ok) => {
      if (cancelled) return;
      setIsAdmin(ok);
      setChecking(false);
    });
    return () => { cancelled = true; };
  }, [adminKey]);

  const login = useCallback(async (key: string) => {
    const ok = await verifyAdminKey(key);
    if (ok) {
      localStorage.setItem(ADMIN_KEY_KEY, key);
      setAdminKey(key);
      setIsAdmin(true);
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ADMIN_KEY_KEY);
    setAdminKey('');
    setIsAdmin(false);
  }, []);

  return { isAdmin, checking, adminKey, login, logout };
};
