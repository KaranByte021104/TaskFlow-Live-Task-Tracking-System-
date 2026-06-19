'use client';

import React, { useState } from 'react';
import Sidebar from '../../components/layout/sidebar';
import Topbar from '../../components/layout/topbar';
import ProjectModal from '../../components/project-modal';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-200">
      {/* Sidebar drawer on mobile / fixed sidebar on desktop */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewProject={() => setIsNewProjectOpen(true)}
      />

      {/* Main page shell container */}
      <div className="flex-1 flex flex-col md:pl-[240px]">
        {/* Top Header bar */}
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />

        {/* Dynamic page content scroll wrapper */}
        <main className="flex-grow pt-24 pb-12 px-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Global Project creation Modal trigger */}
      <ProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
      />
    </div>
  );
}
