import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export const Layout: React.FC = () => {
  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <Sidebar />
      <main className="ml-64 flex flex-col min-h-screen">
        <TopBar />
        <div className="p-8 pb-24">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
