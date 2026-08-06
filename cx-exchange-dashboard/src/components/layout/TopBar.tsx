import React from 'react';

export const TopBar: React.FC = () => {
  return (
    <header className="flex justify-between items-center w-full px-6 h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold text-slate-900 dark:text-white">Logistics & CX Exchange</span>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Data Sync: 10:24 AM</span>
      </div>
      
      {/* 알림·도움말·설정 버튼은 클릭 핸들러가 없는 플레이스홀더라 제거(2026-08-05).
          프로필 아바타는 강희님 요청으로 유지. */}
      <div className="flex items-center gap-4">
        <img
          alt="User Profile" 
          className="w-8 h-8 rounded-full bg-slate-200 object-cover border border-slate-100" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDW_Jq7-1OdjmMc5WO2X3m3f5j5TAIah3b7YV-oiwYtc8_ic2MBcSNLCc8fJR787NDuR_RBK5gnYU7D89ccJBlSGxdUsMW9goq0mqmxe4Jt-gya_3QyuG8RBZP1Fh43R8AnkvOKew-t80DLXkQdnzfJ4KZWb4sNNtTSaHXDS-BRke7yADgukaNNLEkjvFXc1chW2GzB8bJ3bnb6kAcFuCetAiBlas5XhSg4AV7OeJfuTfdS8HLuEAusqJnE0b0fdGSa9wl99R7dVFQ" 
        />
      </div>
    </header>
  );
};
