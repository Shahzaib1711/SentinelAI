"use client";

import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background soc-grid">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
