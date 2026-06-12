"use client";

import { useState } from "react";
import { Bell, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notifications } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface TopNavProps {
  title?: string;
  subtitle?: string;
}

export function TopNav({ title, subtitle }: TopNavProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/60 bg-card/30 px-6 backdrop-blur-sm">
      <div>
        {title && (
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search incidents, cameras, zones..."
            className="w-64 border-border/60 bg-secondary/30 pl-9 text-sm"
          />
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </Button>

          {showNotifications && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border/60 bg-card shadow-panel">
              <div className="border-b border-border/60 p-3">
                <p className="text-sm font-medium">Notifications</p>
              </div>
              <div className="max-h-64 overflow-y-auto scrollbar-thin">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "border-b border-border/30 p-3 transition-colors hover:bg-secondary/30",
                      !n.read && "bg-cyan-500/5"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{n.title}</p>
                      {!n.read && (
                        <Badge variant="outline" className="text-[10px]">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">{n.time}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium">Cmd. Richardson</p>
            <p className="text-[10px] text-muted-foreground">Security Director</p>
          </div>
        </div>
      </div>
    </header>
  );
}
