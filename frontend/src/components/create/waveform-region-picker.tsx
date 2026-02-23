"use client";

import { useEffect, useRef } from "react";
import { WAVESURFER_DEFAULTS, getPrimaryColor } from "@/hooks/use-wavesurfer";

interface WaveformRegionPickerProps {
  audioUrl: string;
  startTime: number;
  endTime: number;
  onTimeChange: (start: number, end: number) => void;
}

export function WaveformRegionPicker({
  audioUrl,
  startTime,
  endTime,
  onTimeChange,
}: WaveformRegionPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);
  const regionRef = useRef<any>(null);
  const isUpdatingRef = useRef(false);

  // Initialize WaveSurfer + Regions plugin
  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    let cancelled = false;

    async function init() {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      const RegionsPlugin = (
        await import("wavesurfer.js/dist/plugins/regions.esm.js")
      ).default;
      if (cancelled || !containerRef.current) return;

      const regions = RegionsPlugin.create();

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: getPrimaryColor(0.4),
        progressColor: getPrimaryColor(0.8),
        cursorColor: getPrimaryColor(0.6),
        barWidth: WAVESURFER_DEFAULTS.barWidth,
        barGap: WAVESURFER_DEFAULTS.barGap,
        barRadius: WAVESURFER_DEFAULTS.barRadius,
        height: 80,
        url: audioUrl,
        plugins: [regions],
      });

      ws.on("ready", () => {
        if (cancelled) return;
        const duration = ws.getDuration();
        const resolvedEnd =
          endTime < 0 ? duration : Math.min(endTime, duration);
        const region = regions.addRegion({
          start: startTime,
          end: resolvedEnd,
          color: "rgba(168, 85, 247, 0.2)",
          drag: true,
          resize: true,
        });
        regionRef.current = region;
      });

      regions.on("region-updated", (region: any) => {
        if (isUpdatingRef.current) return;
        onTimeChange(
          Math.round(region.start * 10) / 10,
          Math.round(region.end * 10) / 10,
        );
      });

      wsRef.current = ws;
    }

    init();

    return () => {
      cancelled = true;
      if (wsRef.current) {
        wsRef.current.destroy();
        wsRef.current = null;
        regionRef.current = null;
      }
    };
  }, [audioUrl]); // Only re-init when audio URL changes

  // Sync region when start/end time changes externally
  useEffect(() => {
    if (!regionRef.current || !wsRef.current) return;
    isUpdatingRef.current = true;
    try {
      const duration = wsRef.current.getDuration();
      const resolvedEnd =
        endTime < 0 ? duration : Math.min(endTime, duration);
      regionRef.current.setOptions({
        start: startTime,
        end: resolvedEnd,
      });
    } catch {
      // Region may not be ready
    }
    isUpdatingRef.current = false;
  }, [startTime, endTime]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Drag the region handles to select the repaint range
      </p>
      <div
        ref={containerRef}
        className="w-full rounded-md border border-border bg-background p-2"
      />
    </div>
  );
}
