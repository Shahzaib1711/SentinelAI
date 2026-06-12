"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { getAppOrigin, getBroadcastPath, getBroadcastUrl } from "@/lib/camera-urls";
import type { Camera } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CameraFeedLinksProps {
  cameras: Camera[];
  className?: string;
}

export function CameraFeedLinks({ cameras, className }: CameraFeedLinksProps) {
  const [origin, setOrigin] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(getAppOrigin(window.location.origin));
  }, []);

  const copyUrl = async (cameraId: string) => {
    const url = origin ? getBroadcastUrl(origin, cameraId) : getBroadcastPath(cameraId);
    await navigator.clipboard.writeText(url);
    setCopiedId(cameraId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (cameras.length === 0) return null;

  return (
    <Card className={cn("soc-panel border-cyan-500/20", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Camera feed links</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Open a link on a phone or device to broadcast live video into that feed slot.
              Use your ngrok HTTPS URL when broadcasting from a phone.
            </p>
            <ul className="mt-3 space-y-2">
              {cameras.map((camera) => {
                const path = getBroadcastPath(camera.id);
                const fullUrl = origin ? getBroadcastUrl(origin, camera.id) : path;

                return (
                  <li
                    key={camera.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                  >
                    <div className="min-w-[4.5rem] shrink-0">
                      <span className="font-mono text-xs font-medium text-cyan-400">{camera.id}</span>
                      <p className="truncate text-[10px] text-muted-foreground">{camera.name}</p>
                    </div>
                    <Link
                      href={path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 flex-1 items-center gap-1 truncate font-mono text-[10px] text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{fullUrl}</span>
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-[10px]"
                      onClick={() => void copyUrl(camera.id)}
                    >
                      {copiedId === camera.id ? (
                        <>
                          <Check className="mr-1 h-3 w-3 text-green-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3 w-3" />
                          Copy
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
