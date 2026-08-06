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
      {/* Content layer */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Navbar */}
        <header className="flex items-center justify-between px-6 md:px-12 lg:px-16 py-5 md:py-6">
          <div className="flex items-center gap-10">
            <span className="text-white font-semibold text-lg tracking-tight font-sans drop-shadow-md">Verish</span>
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

        {/* Hero — 위치·크기·여백은 원본(영문 히어로) 그대로 두고 글자만 한국어로 교체.
            단 Instrument Serif는 한글 글리프가 없어(폰트 폴백 발생) 제목만 sans로 쓴다. */}
        <div className="flex-1 flex flex-col items-center justify-start pt-4 sm:pt-6 md:pt-8 lg:pt-10 px-6 text-center">
          <h1 className="font-sans font-bold text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.2] tracking-tight max-w-5xl">
            교환·반품 데이터를
            <br />
            매일 자동으로 모아
            <br />
            한 화면에서 봅니다
          </h1>

          <p className="mt-4 md:mt-5 text-white/70 text-sm md:text-base font-light max-w-md leading-relaxed">
            자사몰과 외부몰의 교환을 자동으로 모아
            <br className="hidden sm:block" />
            출고량 대비 교환율과 이상 신호를 보여줍니다.
          </p>

          <div className="mt-5 md:mt-6 flex flex-col sm:flex-row items-center gap-4">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 bg-white text-black rounded-full px-7 py-3 text-sm font-medium hover:bg-white/90 transition-colors duration-200"
            >
              CX 대시보드
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/sales"
              className="group inline-flex items-center gap-2 border border-white/40 text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-white/10 hover:border-white/60 transition-colors duration-200"
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
