"use client";

import { useEffect, useState } from "react";
import { personnelApi } from "@/lib/api/personnel";
import type { LivePersonnel, PersonnelSummary } from "@/types";

const EMPTY_SUMMARY: PersonnelSummary = {
  total: 0,
  guards: 0,
  vips: 0,
  visitors: 0,
  updatedAt: 0,
};

export function useLivePersonnel(pollMs = 1000) {
  const [personnel, setPersonnel] = useState<LivePersonnel[]>([]);
  const [summary, setSummary] = useState<PersonnelSummary>(EMPTY_SUMMARY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await personnelApi.live();
        if (cancelled) return;
        setPersonnel(data.personnel);
        setSummary(data.summary);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load personnel");
        }
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollMs]);

  return { personnel, summary, error };
}
