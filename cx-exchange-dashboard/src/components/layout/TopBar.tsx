import React from 'react';
import { Icon } from '../ui/Icon';

export const TopBar: React.FC = () => {
  return (
    <header className="flex justify-between items-center w-full px-6 h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold text-slate-900 dark:text-white">Logistics & CX Exchange</span>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Data Sync: 10:24 AM</span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button className="p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Icon name="notifications" />
          </button>
          <button className="p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Icon name="help" />
          </button>
          <button className="p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Icon name="settings" />
          </button>
        </div>
        
        <img 
          alt="User Profile" 
          className="w-8 h-8 rounded-full bg-slate-200 object-cover border border-slate-100" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDW_Jq7-1OdjmMc5WO2X3m3f5j5TAIah3b7YV-oiwYtc8_ic2MBcSNLCc8fJR787NDuR_RBK5gnYU7D89ccJBlSGxdUsMW9goq0mqmxe4Jt-gya_3QyuG8RBZP1Fh43R8AnkvOKew-t80DLXkQdnzfJ4KZWb4sNNtTSaHXDS-BRke7yADgukaNNLEkjvFXc1chW2GzB8bJ3bnb6kAcFuCetAiBlas5XhSg4AV7OeJfuTfdS8HLuEAusqJnE0b0fdGSa9wl99R7dVFQ" 
        />
      </div>
    </header>
  );
};
