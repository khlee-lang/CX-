import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4';

// 영상이 끝날 때 딱 끊기며 처음으로 튀는 게 보이므로, 시작/끝 0.5초를 페이드로 덮는다.
const FADE_SEC = 0.5;

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

// 배경 영상이 밝아서(2026-08-05 교체) 흰 글씨는 안 보인다 → 검정/회색으로 전환.
const NAV_LINK_CLASS =
  'text-[#6F6F6F] text-sm font-semibold tracking-tight hover:text-black transition-colors duration-200';

export const Landing: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 재생 위치를 매 프레임 보고 시작/끝 0.5초 구간의 opacity를 직접 계산한다.
  // 브라우저 loop 속성은 끝→처음이 하드컷이라, loop을 끄고 ended에서 수동 재시작한다.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let raf = 0;
    const tick = () => {
      const { currentTime: t, duration: d } = video;
      if (d > 0 && !Number.isNaN(d)) {
        const fadeIn = Math.min(1, t / FADE_SEC);
        const fadeOut = Math.min(1, Math.max(0, (d - t) / FADE_SEC));
        video.style.opacity = String(Math.min(fadeIn, fadeOut));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onEnded = () => {
      video.style.opacity = '0';
      window.setTimeout(() => {
        video.currentTime = 0;
        void video.play();
      }, 100);
    };
    video.addEventListener('ended', onEnded);

    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  return (
    <section className="relative w-full h-screen overflow-hidden bg-black">
      {/* Background video — loop 대신 ended 이벤트로 수동 재시작(위 useEffect 참고) */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0 }}
        src={VIDEO_URL}
        autoPlay
        muted
        playsInline
      />
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

        {/* Hero — 제목·부제 문구는 제거(2026-08-05 강희님 요청). 배경 영상만 보이고
            진입 버튼 2개만 남긴다. 문구가 없으니 버튼을 세로 중앙에 둔다. */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 bg-white text-black rounded-full px-7 py-3 text-sm font-medium hover:bg-white/90 transition-colors duration-200"
            >
              CX 대시보드
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/sales"
              className="group inline-flex items-center gap-2 border border-black/30 bg-white/70 text-black rounded-full px-7 py-3 text-sm font-medium hover:bg-white hover:border-black/60 transition-colors duration-200"
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
