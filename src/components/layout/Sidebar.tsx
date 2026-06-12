"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Map,
  MapPin,
  Radio,
  Shield,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/venue-setup", label: "Venue Setup", icon: Map },
  { href: "/coverage-analysis", label: "Coverage Analysis", icon: Target },
  { href: "/route-planning", label: "Route Planning", icon: MapPin },
  { href: "/live-monitoring", label: "Live Monitoring", icon: Radio },
  { href: "/threat-intelligence", label: "Threat Intelligence", icon: Activity },
  { href: "/incident-center", label: "Incident Center", icon: AlertTriangle },
  { href: "/reports", label: "Reports", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      className="relative flex h-screen flex-col border-r border-border/60 bg-card/50 backdrop-blur-sm"
    >
      <div className="flex h-16 items-center gap-3 border-b border-border/60 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
          <Shield className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 className="text-sm font-bold tracking-wide">
              <span className="text-gradient-cyan">Sentinel</span>
              <span className="text-foreground">AI</span>
            </h1>
            <p className="text-[10px] text-muted-foreground">Security Intelligence</p>
          </motion.div>
        )}
      </div>

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
