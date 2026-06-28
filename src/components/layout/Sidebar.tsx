"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Map,
  Radio,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { SentinelLogo } from "@/components/brand/SentinelLogo";
import { EventSelector } from "@/components/shared/EventSelector";

const navItems = [
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/venue-setup", label: "Venue Setup", icon: Map },
  { href: "/security-planning", label: "Security Planning", icon: Brain },
  { href: "/personnel-registry", label: "Personnel Registry", icon: UserCheck },
  { href: "/live-monitoring", label: "Live Monitoring", icon: Radio },
  { href: "/threat-intelligence", label: "Threat Intelligence", icon: Activity },
  { href: "/incident-center", label: "Incident Center", icon: AlertTriangle },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      className="relative flex h-screen flex-col border-r border-border/60 bg-card/50 backdrop-blur-sm"
    >
      <div
        className={cn(
          "flex h-[4.5rem] items-center border-b border-border/60 px-3",
          collapsed ? "justify-center" : "justify-start"
        )}
      >
        <SentinelLogo variant={collapsed ? "icon" : "full"} priority />
      </div>

      {!collapsed && <EventSelector className="border-b border-border/60 py-3" />}

      <nav className="flex-1 space-y-1 overflow-y-auto p-2 scrollbar-thin">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-cyan-400")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {isActive && !collapsed && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-2">
        {!collapsed && (
          <div className="mb-2 rounded-lg bg-secondary/30 p-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-medium">System Status</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-[10px] text-muted-foreground">All systems operational</span>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="w-full"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </motion.aside>
  );
}
