import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204103_f607742e-09da-4cf5-bb06-4e67b0a531de.mp4';

const EASE = 'cubic-bezier(0.76,0,0.24,1)';

// 실제로 들어갈 수 있는 화면만 남긴다(2026-08-05) — 예전 플레이스홀더(Projects/Expertise/
// Studio/Insights, 미희/나연/한슬, Reach Out, Let's Talk)는 링크가 없어서 전부 제거.
const NAV_ITEMS: { label: string; to: string }[] = [
  { label: 'CX 대시보드', to: '/dashboard' },
  { label: 'SALES', to: '/sales' },
];

export const Landing: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section className="relative w-full h-screen overflow-hidden">
      {/* Background video */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
      />
      {/* 밝은 하늘 배경에 흰 글씨가 묻히는 문제 때문에 상하 그라데이션을 덮는다 */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/20 to-black/40" />

      {/* Content layer */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Navbar */}
        <header className="flex items-center justify-between px-6 md:px-12 lg:px-16 py-5 md:py-6">
          <div className="flex items-center gap-10">
            <span className="text-white font-bold text-xl tracking-tight font-sans drop-shadow-md">Verish</span>
            <nav className="hidden lg:flex items-center gap-7 whitespace-nowrap">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="text-white text-sm font-semibold tracking-tight drop-shadow-md hover:text-white/70 transition-colors duration-200"
                >
                  {item.label}
                </Link>
              ))}
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
              className={`block h-[2px] w-6 bg-white rounded-full transition-transform duration-500 ${
                menuOpen ? 'translate-y-[7px] rotate-45' : ''
              }`}
              style={{ transitionTimingFunction: EASE }}
            />
            <span
              className={`block h-[2px] w-4 bg-white rounded-full transition-opacity duration-500 ${
                menuOpen ? 'opacity-0' : 'opacity-100'
              }`}
              style={{ transitionTimingFunction: EASE }}
            />
            <span
              className={`block h-[2px] w-6 bg-white rounded-full transition-transform duration-500 ${
                menuOpen ? '-translate-y-[7px] -rotate-45' : ''
              }`}
              style={{ transitionTimingFunction: EASE }}
            />
          </button>
        </header>

        {/* Hero — 한글이라 Instrument Serif(영문 전용) 대신 sans를 쓴다 */}
        <div className="flex-1 flex flex-col items-center justify-start pt-6 sm:pt-8 md:pt-12 px-6 text-center">
          <p className="text-white/80 text-[11px] md:text-xs font-bold tracking-[0.2em] uppercase mb-5 drop-shadow">
            Verish CX Operations
          </p>
          <h1 className="font-sans font-extrabold text-white text-3xl sm:text-4xl md:text-5xl lg:text-[3.4rem] leading-[1.25] tracking-tight max-w-4xl drop-shadow-lg">
            교환·반품 데이터를
            <br />
            매일 자동으로 모아
            <br />
            한 화면에서 봅니다
          </h1>

          <p className="mt-6 md:mt-7 text-white/85 text-sm md:text-base font-medium leading-relaxed max-w-xl drop-shadow">
            자사몰과 외부몰의 교환 접수부터 출고까지 자동으로 수집·정리하고,
            출고량 대비 교환율과 상품별 이상 신호를 함께 보여줍니다.
          </p>

          <div className="mt-8 md:mt-9 flex flex-col sm:flex-row items-center gap-3">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 bg-white text-black rounded-full px-7 py-3 text-sm font-bold hover:bg-white/90 transition-colors duration-200 shadow-lg"
            >
              CX 대시보드
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/sales"
              className="group inline-flex items-center gap-2 border border-white/60 bg-white/10 backdrop-blur-sm text-white rounded-full px-7 py-3 text-sm font-bold hover:bg-white/20 hover:border-white transition-colors duration-200"
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
            <span className="text-white font-bold text-xl tracking-tight font-sans">Verish</span>
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
            {NAV_ITEMS.map((item, i) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={`block w-full text-center text-3xl sm:text-4xl font-sans font-extrabold text-white border-b border-white/10 py-5 transition-all duration-500 ${
                  menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{
                  transitionTimingFunction: EASE,
                  transitionDelay: menuOpen ? `${150 + i * 80}ms` : '0ms',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
};

export default Landing;
