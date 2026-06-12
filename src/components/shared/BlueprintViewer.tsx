"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Ban,
  Camera,
  Crown,
  DoorOpen,
  LogOut,
  Shield,
  Upload,
} from "lucide-react";
import { computeImageLayout, layoutBoxStyle } from "@/lib/blueprint-layout";
import { cn } from "@/lib/utils";
import type { BlueprintMarker, BlindSpot, CoverageArea, MarkerType } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const markerIcons: Record<MarkerType, React.ElementType> = {
  camera: Camera,
  entrance: DoorOpen,
  exit: LogOut,
  guard: Shield,
  restricted: Ban,
  "vip-route": Crown,
};

const markerColors: Record<MarkerType, string> = {
  camera: "bg-cyan-500 text-black",
  entrance: "bg-green-500 text-black",
  exit: "bg-blue-500 text-white",
  guard: "bg-purple-500 text-white",
  restricted: "bg-red-500 text-white",
  "vip-route": "bg-yellow-500 text-black",
};

interface BlueprintViewerProps {
  markers?: BlueprintMarker[];
  coverageAreas?: CoverageArea[];
  blindSpots?: BlindSpot[];
  routes?: { waypoints: { x: number; y: number }[]; color?: string; isSafest?: boolean }[];
  imageUrl?: string | null;
  floorLabel?: string;
  showCoverage?: boolean;
  showBlindSpots?: boolean;
  showFloorPlanSvg?: boolean;
  activeTool?: MarkerType | null;
  onAddMarker?: (marker: Omit<BlueprintMarker, "id">) => void;
  className?: string;
  empty?: boolean;
}

export function BlueprintViewer({
  markers = [],
  coverageAreas = [],
  blindSpots = [],
  routes = [],
  imageUrl = null,
  floorLabel = "FLOOR PLAN · L1",
  showCoverage = false,
  showBlindSpots = false,
  showFloorPlanSvg = true,
  activeTool = null,
  onAddMarker,
  className,
  empty = false,
}: BlueprintViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!imageUrl) {
      setNaturalSize(null);
      return;
    }

    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (cancelled || probe.naturalWidth <= 0 || probe.naturalHeight <= 0) return;
      setNaturalSize({ w: probe.naturalWidth, h: probe.naturalHeight });
    };
    probe.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();
      setContainerSize((prev) =>
        prev.w === rect.width && prev.h === rect.height
          ? prev
          : { w: rect.width, h: rect.height }
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const imageLayout =
    imageUrl && naturalSize
      ? computeImageLayout(containerSize.w, containerSize.h, naturalSize.w, naturalSize.h)
      : null;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!activeTool || !onAddMarker) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      onAddMarker({
        type: activeTool,
        x,
        y,
        label: `${activeTool}-${Date.now().toString(36)}`,
      });
    },
    [activeTool, onAddMarker]
  );

  const overlayContent = (
    <>
      {showCoverage &&
        coverageAreas.map((area) => (
          <div
            key={area.id}
            className="absolute rounded-full border border-cyan-500/30 bg-cyan-500/10"
            style={{
              left: `${area.x - area.radius / 2}%`,
              top: `${area.y - area.radius / 2}%`,
              width: `${area.radius}%`,
              height: `${area.radius}%`,
            }}
          />
        ))}

      {showBlindSpots &&
        blindSpots.map((spot) => (
          <motion.div
            key={spot.id}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute border-2 border-dashed border-red-500/60 bg-red-500/10"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              width: `${spot.width}%`,
              height: `${spot.height}%`,
            }}
            title={spot.description}
          />
        ))}

      {routes.map((route, ri) => (
        <svg
          key={ri}
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polyline
            points={route.waypoints.map((w) => `${w.x},${w.y}`).join(" ")}
            fill="none"
            stroke={route.isSafest ? "#22c55e" : route.color || "#06b6d4"}
            strokeWidth="0.5"
            strokeDasharray={route.isSafest ? "none" : "1,0.5"}
            opacity="0.8"
          />
          {route.waypoints.map((w, wi) => (
            <circle
              key={wi}
              cx={w.x}
              cy={w.y}
              r="0.8"
              fill={route.isSafest ? "#22c55e" : "#06b6d4"}
            />
          ))}
        </svg>
      ))}

      {markers.map((marker) => {
        const Icon = markerIcons[marker.type];
        return (
          <Tooltip key={marker.id}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.2 }}
                onMouseEnter={() => setHoveredMarker(marker.id)}
                onMouseLeave={() => setHoveredMarker(null)}
                className={cn(
                  "absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg",
                  markerColors[marker.type],
                  hoveredMarker === marker.id && "ring-2 ring-white/50"
                )}
                style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              >
                <Icon className="h-3 w-3" />
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{marker.label}</p>
              <p className="text-[10px] capitalize opacity-80">{marker.type.replace("-", " ")}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );

  if (empty) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/50 py-20",
          className
        )}
      >
        <Upload className="mb-4 h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          No blueprint uploaded
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Upload a floor plan, blueprint, or site map to begin
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className={cn(
          "relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border/60 bg-[#0d1117]",
          className
        )}
      >
        {/* Blueprint grid background */}
        <div className="absolute inset-0 soc-grid" />

        {imageUrl && imageLayout ? (
          <div
            className={cn("absolute", activeTool && "cursor-crosshair")}
            style={layoutBoxStyle(imageLayout)}
            onClick={handleClick}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Venue blueprint"
              className="pointer-events-none h-full w-full opacity-90"
            />
            {overlayContent}
          </div>
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Venue blueprint"
            className="absolute inset-0 h-full w-full object-contain opacity-90"
          />
        ) : null}

        {/* Default floor plan when no upload */}
        {showFloorPlanSvg && !imageUrl && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Outer walls */}
          <rect x="3" y="3" width="94" height="94" fill="none" stroke="#1e3a5f" strokeWidth="0.3" />
          {/* Rooms */}
          <rect x="3" y="3" width="47" height="30" fill="#111827" stroke="#1e3a5f" strokeWidth="0.15" />
          <rect x="50" y="3" width="47" height="30" fill="#111827" stroke="#1e3a5f" strokeWidth="0.15" />
          <rect x="3" y="33" width="30" height="35" fill="#111827" stroke="#1e3a5f" strokeWidth="0.15" />
          <rect x="33" y="33" width="34" height="35" fill="#111827" stroke="#1e3a5f" strokeWidth="0.15" />
          <rect x="67" y="33" width="30" height="35" fill="#111827" stroke="#1e3a5f" strokeWidth="0.15" />
          <rect x="3" y="68" width="47" height="29" fill="#111827" stroke="#1e3a5f" strokeWidth="0.15" />
          <rect x="50" y="68" width="47" height="29" fill="#111827" stroke="#1e3a5f" strokeWidth="0.15" />
          {/* Corridors */}
          <line x1="50" y1="3" x2="50" y2="97" stroke="#1e3a5f" strokeWidth="0.1" strokeDasharray="1,1" />
          <line x1="3" y1="33" x2="97" y2="33" stroke="#1e3a5f" strokeWidth="0.1" strokeDasharray="1,1" />
          <line x1="3" y1="68" x2="97" y2="68" stroke="#1e3a5f" strokeWidth="0.1" strokeDasharray="1,1" />
          {/* Labels */}
          <text x="26" y="20" fill="#4b5563" fontSize="2.5" textAnchor="middle">LOBBY</text>
          <text x="73" y="20" fill="#4b5563" fontSize="2.5" textAnchor="middle">CONFERENCE</text>
          <text x="18" y="52" fill="#4b5563" fontSize="2" textAnchor="middle">OFFICES</text>
          <text x="50" y="52" fill="#4b5563" fontSize="2" textAnchor="middle">CORRIDOR</text>
          <text x="82" y="52" fill="#4b5563" fontSize="2" textAnchor="middle">VIP LOUNGE</text>
          <text x="26" y="84" fill="#4b5563" fontSize="2" textAnchor="middle">PARKING</text>
          <text x="73" y="84" fill="#4b5563" fontSize="2" textAnchor="middle">LOADING</text>
        </svg>
        )}

        {!imageUrl && (
          <div
            className={cn("absolute inset-0", activeTool && "cursor-crosshair")}
            onClick={handleClick}
          >
            {overlayContent}
          </div>
        )}

        {/* Scan line effect */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute inset-x-0 h-8 animate-scan bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" />
        </div>

        {/* Coordinates overlay */}
        <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-cyan-400">
          {floorLabel}
        </div>
      </div>
    </TooltipProvider>
  );
}
