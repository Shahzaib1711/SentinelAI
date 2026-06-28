"use client";

import dynamic from "next/dynamic";
import { useEvent } from "@/contexts/EventContext";

const Sidebar = dynamic(() => import("./Sidebar").then((m) => m.Sidebar), {
  ssr: false,
  loading: () => (
    <aside className="h-screen w-[240px] shrink-0 border-r border-border/60 bg-card/50" />
  ),
});

const TopNav = dynamic(() => import("./TopNav").then((m) => m.TopNav), {
  ssr: false,
  loading: () => (
    <header className="flex h-16 shrink-0 items-center border-b border-border/60 bg-card/30 px-6" />
  ),
});

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const { event } = useEvent();
  const resolvedSubtitle =
    subtitle ??
    (event ? `${event.name} · ${event.venueName}` : "Select or create an event");

  return (
    <div className="flex h-screen overflow-hidden bg-background soc-grid">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav title={title} subtitle={resolvedSubtitle} />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">{children}</main>
      </div>
    </div>
  );
}
