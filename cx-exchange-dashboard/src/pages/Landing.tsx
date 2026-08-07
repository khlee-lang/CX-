import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { VerishSymbol, WORD_LETTERS, WORD_VIEWBOX } from '../components/brand/verishLogo';
import { useAdmin } from '../hooks/useAdmin';

const EASE = 'cubic-bezier(0.76,0,0.24,1)';

// 실제로 들어갈 수 있는 화면만 남긴다(2026-08-05) — 예전 플레이스홀더(Projects/Expertise/
// Studio/Insights, 미희/나연/한슬, Reach Out, Let's Talk)는 링크가 없어서 전부 제거.
// external: 이 앱 외부(Cloud Run 등) 주소라 react-router Link가 아닌 <a>로 열어야 한다.
type NavItem = { label: string; to: string; external?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: 'CX', to: '/dashboard' },
  { label: 'SALES', to: '/sales' },
  {
    label: '재입고 일정',
    to: 'https://product-inbound-service-625681502302.asia-northeast3.run.app/',
    external: true,
  },
];

// 관리자에게만 보이는 메뉴 (프로젝트 간트). SALES 수정요청과 같은 키를 공유하므로
// SALES에서 이미 관리자면 홈에서도 자동으로 보인다.
const ADMIN_NAV_ITEMS: NavItem[] = [{ label: '프로젝트', to: '/projects' }];

// 배경이 흰색이라 흰 글씨는 안 보인다 → 검정/회색.
const NAV_LINK_CLASS =
  'text-[#6F6F6F] text-sm font-semibold tracking-tight hover:text-black transition-colors duration-200';

export const Landing: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAdmin, login, logout } = useAdmin();
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const navItems = useMemo(
    () => (isAdmin ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS),
    [isAdmin],
  );

  const submitKey = async () => {
    if (!keyInput.trim() || verifying) return;
    setVerifying(true);
    setKeyError('');
    const ok = await login(keyInput.trim());
    setVerifying(false);
    if (ok) {
      setKeyModalOpen(false);
      setKeyInput('');
    } else {
      setKeyError('키가 올바르지 않습니다.');
    }
  };

  return (
    <section className="relative w-full h-screen overflow-hidden bg-white">
      {/* Content layer */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Navbar */}
        <header className="flex items-center justify-between px-6 md:px-12 lg:px-16 py-5 md:py-6">
          <div className="flex items-center gap-10">
            <span className="text-black font-semibold text-lg tracking-tight font-sans">Verish</span>
            <nav className="hidden lg:flex items-center gap-7 whitespace-nowrap">
              {navItems.map((item) =>
                item.external ? (
                  <a
                    key={item.label}
                    href={item.to}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={NAV_LINK_CLASS}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link key={item.label} to={item.to} className={NAV_LINK_CLASS}>
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
          </div>

          {/* Hamburger (mobile) */}
          <button
            type="button"
            aria-label="메뉴 열기"
            onClick={() => setMenuOpen(true)}
            className="lg:hidden flex flex-col items-end justify-center gap-1.5 w-8 h-8"
          >
            <span
              className={`block h-[2px] w-6 bg-black rounded-full transition-transform duration-500 ${
                menuOpen ? 'translate-y-[7px] rotate-45' : ''
              }`}
              style={{ transitionTimingFunction: EASE }}
            />
            <span
              className={`block h-[2px] w-4 bg-black rounded-full transition-opacity duration-500 ${
                menuOpen ? 'opacity-0' : 'opacity-100'
              }`}
              style={{ transitionTimingFunction: EASE }}
            />
            <span
              className={`block h-[2px] w-6 bg-black rounded-full transition-transform duration-500 ${
                menuOpen ? '-translate-y-[7px] -rotate-45' : ''
              }`}
              style={{ transitionTimingFunction: EASE }}
            />
          </button>
        </header>

        {/* Hero — 배경 영상을 지우고 브랜드 로고(심볼+워드마크)를 주인공으로 둔다
            (2026-08-05 강희님 요청). 원본 PDF와 같은 좌우 배치, 좁은 화면에서는 세로 스택. */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="flex flex-col sm:flex-row items-center gap-8 sm:gap-14 md:gap-20">
            {/* 심볼 — 뒤에서 옅은 링이 퍼지고, 진입 후 은은하게 상하로 움직인다 */}
            <div className="relative verish-symbol-in">
              <span
                aria-hidden="true"
                className="verish-ripple absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full
                           border border-black/30 w-28 h-28 sm:w-32 sm:h-32 md:w-44 md:h-44"
              />
              <div className="verish-float relative">
                <VerishSymbol className="h-20 sm:h-24 md:h-32 w-auto text-black" />
              </div>
            </div>

            {/* 워드마크 — 글자 하나씩 아래에서 올라온다. 심볼과 같은 높이(원본 비율) */}
            <svg
              viewBox={WORD_VIEWBOX}
              className="h-20 sm:h-24 md:h-32 w-auto text-black"
              fill="currentColor"
              role="img"
              aria-label="Verish"
            >
              {WORD_LETTERS.map((letter, i) => (
                <g
                  key={letter.label}
                  className="verish-letter-in"
                  style={{ animationDelay: `${450 + i * 90}ms` }}
                >
                  {letter.d.map((d, j) => (
                    <path key={j} fillRule="nonzero" d={d} />
                  ))}
                </g>
              ))}
            </svg>
          </div>

          {/* 링이 scale 2.6까지 퍼지므로 버튼과 겹쳐 보이지 않게 여백을 넉넉히 준다 */}
          <div className="mt-20 md:mt-28 flex flex-col sm:flex-row items-center gap-4">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 bg-black text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-black/85 transition-colors duration-200"
            >
              CX
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/sales"
              className="group inline-flex items-center gap-2 border border-black/25 text-black rounded-full px-7 py-3 text-sm font-medium hover:bg-black/5 hover:border-black/60 transition-colors duration-200"
            >
              SALES
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 관리자 진입 — 우하단에 은은하게. 관리자면 배지 + 로그아웃으로 바뀐다 */}
      <div className="absolute bottom-5 right-6 z-20 flex items-center gap-3">
        {isAdmin ? (
          <>
            <span className="text-[11px] font-semibold text-black/50">관리자 모드</span>
            <button
              type="button"
              onClick={logout}
              className="text-[11px] font-semibold text-black/35 hover:text-black transition-colors duration-200"
            >
              해제
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { setKeyModalOpen(true); setKeyError(''); }}
            className="text-[11px] font-semibold text-black/25 hover:text-black/60 transition-colors duration-200"
          >
            관리자
          </button>
        )}
      </div>

      {/* 관리자 키 입력 모달 */}
      {keyModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setKeyModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-[320px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-black mb-1">관리자 키</p>
            <p className="text-xs text-black/45 mb-4">SALES 수정요청 관리자 키와 동일합니다.</p>
            <input
              type="password"
              autoFocus
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submitKey(); }}
              placeholder="키 입력"
              className="w-full border border-black/15 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-black/50 transition-colors"
            />
            {keyError && <p className="text-xs text-rose-600 mt-2">{keyError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setKeyModalOpen(false)}
                className="text-xs font-semibold text-black/40 hover:text-black px-3 py-2 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void submitKey()}
                disabled={verifying || !keyInput.trim()}
                className="text-xs font-bold bg-black text-white rounded-xl px-4 py-2 disabled:opacity-40 hover:bg-black/85 transition-colors"
              >
                {verifying ? '확인 중…' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden ${menuOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/90 backdrop-blur-xl transition-opacity duration-700 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transitionTimingFunction: EASE }}
        />

        <div
          className={`relative h-full flex flex-col transition-opacity duration-700 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transitionTimingFunction: EASE }}
        >
          <div className="flex items-center justify-between px-6 py-5">
            <span className="text-white font-semibold text-lg tracking-tight font-sans">Verish</span>
            <button
              type="button"
              aria-label="메뉴 닫기"
              onClick={() => setMenuOpen(false)}
              className="relative w-8 h-8"
            >
              <span className="absolute left-1 top-1/2 block h-[2px] w-6 bg-white rounded-full rotate-45" />
              <span className="absolute left-1 top-1/2 block h-[2px] w-6 bg-white rounded-full -rotate-45" />
            </button>
          </div>

          <nav className="flex-1 flex flex-col justify-center px-6">
            {navItems.map((item, i) => {
              const cls = `block w-full text-center text-3xl sm:text-4xl font-sans font-extrabold text-white border-b border-white/10 py-5 transition-all duration-500 ${
                menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`;
              const style = {
                transitionTimingFunction: EASE,
                transitionDelay: menuOpen ? `${150 + i * 80}ms` : '0ms',
              };
              return item.external ? (
                <a
                  key={item.label}
                  href={item.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className={cls}
                  style={style}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={cls}
                  style={style}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </section>
  );
};

export default Landing;
