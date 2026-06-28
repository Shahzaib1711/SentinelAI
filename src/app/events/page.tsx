"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  Plus,
  Shield,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageElements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEvent } from "@/contexts/EventContext";
import { cn, formatDateTime } from "@/lib/utils";

export default function EventsPage() {
  const router = useRouter();
  const { slug, events, loading, error, createEvent, setActiveSlug, refresh } = useEvent();
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    venueName: "",
    eventDate: "",
    floorLevel: "L1",
    attendees: "",
    vipCount: "",
    securityPersonnel: "",
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      await createEvent({
        name: form.name.trim(),
        venueName: form.venueName.trim(),
        eventDate: form.eventDate,
        floorLevel: form.floorLevel.trim() || "L1",
        attendees: form.attendees ? Number(form.attendees) : 0,
        vipCount: form.vipCount ? Number(form.vipCount) : 0,
        securityPersonnel: form.securityPersonnel ? Number(form.securityPersonnel) : 0,
      });
      router.push("/venue-setup");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setCreating(false);
    }
  };

  const selectEvent = (eventSlug: string, hasFloorPlan: boolean) => {
    setActiveSlug(eventSlug);
    router.push(hasFloorPlan ? "/dashboard" : "/venue-setup");
  };

  return (
    <AppLayout
      title="Events"
      subtitle="Create and manage security operations per event"
    >
      <PageHeader
        title="Event Operations"
        description="Every workflow — blueprint analysis, security planning, personnel, and live monitoring — runs inside an event. Create one, then set up the venue floor plan."
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? "Hide form" : "New event"}
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      )}

      {showForm && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="soc-panel mb-6 border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-base">Create new event</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Event name</label>
                  <Input
                    required
                    placeholder="Global Security Summit 2026"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Venue name</label>
                  <Input
                    required
                    placeholder="Metropolitan Convention Center"
                    value={form.venueName}
                    onChange={(e) => setForm((f) => ({ ...f, venueName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Event date</label>
                  <Input
                    required
                    type="date"
                    value={form.eventDate}
                    onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Floor level</label>
                  <Input
                    placeholder="L1"
                    value={form.floorLevel}
                    onChange={(e) => setForm((f) => ({ ...f, floorLevel: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Expected attendees</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="5000"
                    value={form.attendees}
                    onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">VIP count</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="12"
                    value={form.vipCount}
                    onChange={(e) => setForm((f) => ({ ...f, vipCount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-medium">Security personnel</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="24"
                    value={form.securityPersonnel}
                    onChange={(e) => setForm((f) => ({ ...f, securityPersonnel: e.target.value }))}
                  />
                </div>
                {formError && (
                  <p className="text-sm text-red-400 md:col-span-2">{formError}</p>
                )}
                <div className="md:col-span-2">
                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create event & set up venue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <Card className="soc-panel border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="mb-4 h-12 w-12 text-cyan-500/50" />
            <h3 className="text-lg font-medium">No events yet</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Create your first event with a venue name and date. You&apos;ll upload the floor plan
              next, then run security planning and live monitoring for that event.
            </p>
            <Button className="mt-6" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create first event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => {
            const isActive = event.slug === slug;
            return (
              <motion.div key={event.id} whileHover={{ y: -2 }}>
                <Card
                  className={cn(
                    "soc-panel cursor-pointer transition-colors hover:border-cyan-500/30",
                    isActive && "border-cyan-500/40 ring-1 ring-cyan-500/20"
                  )}
                  onClick={() => selectEvent(event.slug, event.hasFloorPlan)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-tight">{event.name}</CardTitle>
                      {isActive && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                      <span>{event.venueName}</span>
                      {event.floorLevel && (
                        <span className="rounded bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px]">
                          {event.floorLevel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                      <span>{formatDateTime(event.eventDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                      <span>
                        {event.attendees.toLocaleString()} attendees · {event.securityPersonnel} security
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-medium uppercase",
                          event.hasFloorPlan
                            ? "bg-green-500/10 text-green-400"
                            : "bg-amber-500/10 text-amber-400"
                        )}
                      >
                        {event.hasFloorPlan ? "Floor plan ready" : "Needs floor plan"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{event.slug}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
