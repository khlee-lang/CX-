import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204103_f607742e-09da-4cf5-bb06-4e67b0a531de.mp4';

const EASE = 'cubic-bezier(0.76,0,0.24,1)';

type NavItem = { label: string; to?: string };

const NAV_ITEMS: NavItem[] = [
  { label: 'CX 대시보드', to: '/dashboard' },
  { label: 'SALES', to: '/sales' },
  { label: '미희' },
  { label: '나연' },
  { label: '한슬' },
];

const MOBILE_ITEMS: NavItem[] = [...NAV_ITEMS, { label: 'Reach Out' }];

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
            <span className="text-white font-semibold text-lg tracking-tight font-sans">Atelier</span>
            <nav className="hidden lg:flex items-center gap-6 whitespace-nowrap">
              {NAV_ITEMS.map((item) =>
                item.to ? (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="text-white/80 hover:text-white text-sm font-light transition-colors duration-200"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.label}
                    href="#"
                    className="text-white/80 hover:text-white text-sm font-light transition-colors duration-200"
                  >
                    {item.label}
                  </a>
                ),
              )}
            </nav>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="#"
              className="hidden lg:inline text-white/80 hover:text-white text-sm font-light transition-colors duration-200"
            >
              Reach Out
            </a>
            <Link
              to="/dashboard"
              className="hidden lg:inline-block bg-white text-black rounded-full px-5 py-2 text-sm font-medium hover:bg-white/90 transition-colors duration-200"
            >
              Let&apos;s Talk
            </Link>

            {/* Hamburger */}
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
          </div>
        </header>

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-start pt-4 sm:pt-6 md:pt-8 lg:pt-10 px-6 text-center">
          <h1 className="font-instrument-serif text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-[1.1] max-w-5xl">
            UX <span className="italic font-instrument-serif">and</span> APP
            <br />
            DESIGN <span className="italic font-instrument-serif">for</span> BOLD
            <br />
            VENTURES
          </h1>

          <p className="mt-4 md:mt-5 text-white/70 text-sm md:text-base font-light max-w-md leading-relaxed">
            We shape digital products that define brands{' '}
            <br className="hidden sm:block" />
            and unlock exponential growth.
          </p>

          <div className="mt-5 md:mt-6 flex flex-col sm:flex-row items-center gap-4">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 bg-white text-black rounded-full px-7 py-3 text-sm font-medium hover:bg-white/90 transition-colors duration-200"
            >
              See Cases
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-2 border border-white/40 text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-white/10 hover:border-white/60 transition-colors duration-200"
            >
              <Play className="w-4 h-4" />
              Watch Reel
            </button>
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
            <span className="text-white font-semibold text-lg tracking-tight font-sans">Atelier</span>
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
            {MOBILE_ITEMS.map((item, i) => {
              const cls = `block w-full text-center text-4xl sm:text-5xl font-instrument-serif text-white border-b border-white/10 py-4 hover:pl-4 transition-all duration-500 ${
                menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`;
              const style = {
                transitionTimingFunction: EASE,
                transitionDelay: menuOpen ? `${150 + i * 80}ms` : '0ms',
              };
              return item.to ? (
                <Link key={item.label} to={item.to} className={cls} style={style} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              ) : (
                <a key={item.label} href="#" className={cls} style={style} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="px-6 pb-8">
            <Link
              to="/dashboard"
              onClick={() => setMenuOpen(false)}
              className={`block w-full text-center bg-white text-black rounded-full py-4 text-sm font-medium transition-all duration-700 ${
                menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionTimingFunction: EASE, transitionDelay: menuOpen ? '550ms' : '0ms' }}
            >
              Let&apos;s Talk
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Landing;
