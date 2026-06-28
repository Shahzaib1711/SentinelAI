"use client";

import { useEvent } from "@/contexts/EventContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface EventSelectorProps {
  collapsed?: boolean;
  className?: string;
}

export function EventSelector({ collapsed, className }: EventSelectorProps) {
  const { slug, events, loading, setActiveSlug } = useEvent();

  if (loading && events.length === 0) {
    return (
      <div className={cn("px-3 py-2 text-[10px] text-muted-foreground", className)}>
        Loading events...
      </div>
    );
  }

  if (events.length === 0) {
    return null;
  }

  const active = events.find((e) => e.slug === slug);

  if (collapsed) {
    return (
      <div
        className={cn(
          "mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10",
          className
        )}
        title={active?.name ?? "Select event"}
      >
        <span className="text-[10px] font-bold text-cyan-400">
          {(active?.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("px-2", className)}>
      <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Active event
      </p>
      <Select value={slug} onValueChange={setActiveSlug}>
        <SelectTrigger className="h-9 border-border/60 bg-secondary/30 text-xs">
          <SelectValue placeholder="Select event" />
        </SelectTrigger>
        <SelectContent>
          {events.map((event) => (
            <SelectItem key={event.slug} value={event.slug} className="text-xs">
              {event.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
