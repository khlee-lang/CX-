import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { VerishSymbol, WORD_LETTERS, WORD_VIEWBOX } from '../components/brand/verishLogo';

const EASE = 'cubic-bezier(0.76,0,0.24,1)';

// 실제로 들어갈 수 있는 화면만 남긴다(2026-08-05) — 예전 플레이스홀더(Projects/Expertise/
// Studio/Insights, 미희/나연/한슬, Reach Out, Let's Talk)는 링크가 없어서 전부 제거.
// external: 이 앱 외부(Cloud Run 등) 주소라 react-router Link가 아닌 <a>로 열어야 한다.
type NavItem = { label: string; to: string; external?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: 'CX 대시보드', to: '/dashboard' },
  { label: 'SALES', to: '/sales' },
  {
    label: '재입고 일정',
    to: 'https://product-inbound-service-625681502302.asia-northeast3.run.app/',
    external: true,
  },
];

// 배경이 흰색이라 흰 글씨는 안 보인다 → 검정/회색.
const NAV_LINK_CLASS =
  'text-[#6F6F6F] text-sm font-semibold tracking-tight hover:text-black transition-colors duration-200';

export const Landing: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section className="relative w-full h-screen overflow-hidden bg-white">
      {/* Content layer */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Navbar */}
        <header className="flex items-center justify-between px-6 md:px-12 lg:px-16 py-5 md:py-6">
          <div className="flex items-center gap-10">
            <span className="text-black font-semibold text-lg tracking-tight font-sans">Verish</span>
            <nav className="hidden lg:flex items-center gap-7 whitespace-nowrap">
              {NAV_ITEMS.map((item) =>
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
              CX 대시보드
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/sales"
              className="group inline-flex items-center gap-2 border border-black/25 text-black rounded-full px-7 py-3 text-sm font-medium hover:bg-black/5 hover:border-black/60 transition-colors duration-200"
            >
              세일즈 리포트
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>

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
            {NAV_ITEMS.map((item, i) => {
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
