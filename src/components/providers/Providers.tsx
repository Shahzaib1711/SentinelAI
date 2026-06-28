"use client";

import type { ReactNode } from "react";
import { EventProvider } from "@/contexts/EventContext";

export function Providers({ children }: { children: ReactNode }) {
  return <EventProvider>{children}</EventProvider>;
}
