"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BlueprintViewer } from "@/components/shared/BlueprintViewer";
import { RouteCard } from "@/components/shared/RouteCard";
import { PageHeader, LoadingState } from "@/components/shared/PageElements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { blueprintApi } from "@/lib/api/blueprint";
import { routesApi } from "@/lib/api/routes";
import type { BlueprintMarker, Route } from "@/types";

function defaultStart(locations: { value: string; type: string }[]): string {
  const entrance = locations.find((l) => l.type === "entrance");
  return entrance?.value ?? locations[0]?.value ?? "";
}

function defaultDestination(locations: { value: string; type: string }[]): string {
  const restricted = locations.find((l) => l.type === "restricted");
  const exit = locations.find((l) => l.type === "exit");
  return restricted?.value ?? exit?.value ?? locations[locations.length - 1]?.value ?? "";
}

export default function RoutePlanningPage() {
  const [loading, setLoading] = useState(true);
  const [advising, setAdvising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<BlueprintMarker[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ value: string; label: string; type: string }[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [advisories, setAdvisories] = useState<string[]>([]);
  const [eventName, setEventName] = useState("");
  const [startLocation, setStartLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("");

  const loadAdvice = useCallback(async (start: string, dest: string) => {
    if (!start || !dest || start === dest) return;
    setAdvising(true);
    setError(null);
    try {
      const res = await routesApi.advise(start, dest);
      setLocations(res.locations);
      setRoutes(res.routes);
      setAdvisories(res.advisories);
      setEventName(res.event.name);
      const safest = res.routes.find((r) => r.isSafest);
      setSelectedRoute((prev) =>
        res.routes.some((r) => r.id === prev) ? prev : safest?.id ?? res.routes[0]?.id ?? ""
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to advise routes");
      setRoutes([]);
      setAdvisories([]);
    } finally {
      setAdvising(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const bp = await blueprintApi.get();
        const planMarkers = bp.blueprint.markers.filter((m) => m.type !== "vip-route");
        setMarkers(planMarkers);
        setImageUrl(bp.blueprint.storageUrl);

        const locs = planMarkers
          .filter((m) =>
            ["entrance", "exit", "guard", "restricted", "camera"].includes(m.type)
          )
          .map((m) => ({ value: m.id, label: m.label, type: m.type }));

        setLocations(locs);

        if (locs.length >= 2) {
          const start = defaultStart(locs);
          const dest = defaultDestination(locs);
          setStartLocation(start);
          setDestination(dest);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load blueprint");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loading && startLocation && destination) {
      void loadAdvice(startLocation, destination);
    }
  }, [startLocation, destination, loading, loadAdvice]);

  const selectedRouteData = routes.find((r) => r.id === selectedRoute);

  if (loading) {
    return (
      <AppLayout title="Route Planning" subtitle="Event-based escort route advisory">
        <LoadingState message="Loading blueprint and route options..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Route Planning"
      subtitle={`Advised routes from detected venue markers${eventName ? ` · ${eventName}` : ""}`}
    >
      <PageHeader
        title="VIP Route Planning"
        description="Auto-detect cameras, entrances, and zones in Venue Setup — routes are advised here based on your event"
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <Card className="soc-panel mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Start Location
            </label>
            <Select value={startLocation} onValueChange={setStartLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select start" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.value} value={loc.value}>
                    {loc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Destination
            </label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.value} value={loc.value}>
                    {loc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {advising && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              Updating routes…
            </div>
          )}
        </CardContent>
      </Card>

      {advisories.length > 0 && (
        <Card className="soc-panel mb-6 border-cyan-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-cyan-400" />
              Event advisories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {advisories.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="text-cyan-500">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Advised Routes
          </h3>
          {routes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add markers in Venue Setup, then pick start and destination.
            </p>
          ) : (
            routes.map((route, i) => (
              <motion.div
                key={route.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <RouteCard
                  route={route}
                  selected={selectedRoute === route.id}
                  onSelect={() => setSelectedRoute(route.id)}
                />
              </motion.div>
            ))
          )}
        </div>

        <Card className="soc-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Route Visualization
              {selectedRouteData && (
                <span className="ml-2 font-mono text-cyan-400">
                  — {selectedRouteData.name}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BlueprintViewer
              markers={markers}
              imageUrl={imageUrl}
              routes={routes.map((r) => ({
                waypoints: r.waypoints,
                isSafest: r.isSafest,
                color: r.id === selectedRoute ? "#06b6d4" : "#334155",
              }))}
            />
            <div className="mt-3 flex gap-4 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 bg-green-500" />
                <span className="text-muted-foreground">Lowest risk (recommended)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 border-t border-dashed border-slate-500" />
                <span className="text-muted-foreground">Alternative routes</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
