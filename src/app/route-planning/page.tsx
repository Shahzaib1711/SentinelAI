"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { BlueprintViewer } from "@/components/shared/BlueprintViewer";
import { RouteCard } from "@/components/shared/RouteCard";
import { PageHeader } from "@/components/shared/PageElements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { routes, locationOptions, blueprintMarkers } from "@/lib/mock-data";

export default function RoutePlanningPage() {
  const [startLocation, setStartLocation] = useState("main-entrance");
  const [destination, setDestination] = useState("vip-lounge");
  const [selectedRoute, setSelectedRoute] = useState("route-b");

  const selectedRouteData = routes.find((r) => r.id === selectedRoute);

  return (
    <AppLayout
      title="Route Planning"
      subtitle="VIP escort route analysis and optimization"
    >
      <PageHeader
        title="VIP Route Planning"
        description="Plan and compare secure escort routes with risk assessment"
      />

      {/* Location Selectors */}
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
                {locationOptions.map((loc) => (
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
                {locationOptions.map((loc) => (
                  <SelectItem key={loc.value} value={loc.value}>
                    {loc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Route Cards */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Available Routes
          </h3>
          {routes.map((route, i) => (
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
          ))}
        </div>

        {/* Blueprint with routes */}
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
              markers={blueprintMarkers}
              routes={routes.map((r) => ({
                waypoints: r.waypoints,
                isSafest: r.isSafest,
                color: r.id === selectedRoute ? "#06b6d4" : "#334155",
              }))}
            />
            <div className="mt-3 flex gap-4 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 bg-green-500" />
                <span className="text-muted-foreground">Safest Route (Recommended)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 border-t border-dashed border-slate-500" />
                <span className="text-muted-foreground">Alternative Routes</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
