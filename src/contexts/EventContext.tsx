"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  eventsApi,
  type CreateEventInput,
  type EventSummary,
} from "@/lib/api/events";
import {
  ACTIVE_EVENT_SLUG_KEY,
  DEFAULT_EVENT_SLUG,
  getStoredEventSlug,
  setStoredEventSlug,
} from "@/lib/services/events";

interface EventContextValue {
  slug: string;
  event: EventSummary | null;
  events: EventSummary[];
  loading: boolean;
  error: string | null;
  setActiveSlug: (slug: string) => void;
  refresh: () => Promise<void>;
  createEvent: (input: CreateEventInput) => Promise<EventSummary>;
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState(DEFAULT_EVENT_SLUG);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSlug(getStoredEventSlug());
    setHydrated(true);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { events: list } = await eventsApi.list();
      setEvents(list);

      const activeSlug = getStoredEventSlug();
      const match = list.find((e) => e.slug === activeSlug);
      if (match) {
        setEvent(match);
        setSlug(match.slug);
      } else if (list.length > 0) {
        setStoredEventSlug(list[0].slug);
        setSlug(list[0].slug);
        setEvent(list[0]);
      } else {
        setEvent(null);
        setSlug(DEFAULT_EVENT_SLUG);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refresh();
  }, [hydrated, refresh]);

  const setActiveSlug = useCallback(
    (next: string) => {
      setStoredEventSlug(next);
      setSlug(next);
      const match = events.find((e) => e.slug === next);
      if (match) {
        setEvent(match);
      } else {
        void eventsApi
          .get(next)
          .then((res) => setEvent(res.event))
          .catch(() => setEvent(null));
      }
    },
    [events]
  );

  const createEvent = useCallback(
    async (input: CreateEventInput) => {
      const res = await eventsApi.create(input);
      setStoredEventSlug(res.event.slug);
      setSlug(res.event.slug);
      setEvent(res.event);
      await refresh();
      return res.event;
    },
    [refresh]
  );

  const value = useMemo(
    () => ({
      slug,
      event,
      events,
      loading,
      error,
      setActiveSlug,
      refresh,
      createEvent,
    }),
    [slug, event, events, loading, error, setActiveSlug, refresh, createEvent]
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error("useEvent must be used within EventProvider");
  }
  return ctx;
}
