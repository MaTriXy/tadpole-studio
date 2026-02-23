"use client";

import { type ReactNode, useRef } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchHealth } from "@/lib/api/client";
import { AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { useEngineSwitchStore } from "@/stores/engine-switch-store";

export function ConnectionBanner() {
  const hasConnected = useRef(false);
  const lastContent = useRef<ReactNode>(null);
  const switchingTo = useEngineSwitchStore((s) => s.switchingTo);

  const { data, status } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    // Poll faster while backend isn't fully ready, slower once connected
    refetchInterval: (query) => {
      const d = query.state.data;
      return hasConnected.current && d?.dit_model_loaded && d?.lm_model_loaded ? 10_000 : 2_000;
    },
    retry: false,
    placeholderData: keepPreviousData,
    // Only re-render when data or status actually change (not errorUpdatedAt, etc.)
    notifyOnChangeProps: ["data", "status"],
  });

  const isError = status === "error";

  if (data) {
    hasConnected.current = true;
  }

  // Compute banner content (null = nothing to show)
  let bannerContent: ReactNode = null;

  if (status === "pending") {
    // No content yet
  } else if (isError) {
    if (!hasConnected.current) {
      bannerContent = (
        <div className="flex items-center gap-2 bg-purple-500/10 px-4 py-2 text-sm text-purple-600 dark:text-purple-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Starting backend...</span>
        </div>
      );
    } else {
      bannerContent = (
        <div className="flex items-center gap-2 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <WifiOff className="h-4 w-4" />
          <span>Lost connection to backend. Check that the server is still running.</span>
        </div>
      );
    }
  } else if (data?.init_stage === "error" && data.init_error) {
    const errorMsg = data.init_error.length > 200
      ? data.init_error.slice(0, 200) + "..."
      : data.init_error;
    bannerContent = (
      <div className="flex items-center gap-2 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Initialization failed: {errorMsg}</span>
      </div>
    );
  } else if (data && switchingTo && data.active_backend !== switchingTo) {
    const engineName = switchingTo === "ace-step" ? "ACE-Step" : "HeartMuLa";
    bannerContent = (
      <div className="flex items-center gap-2 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Switching to {engineName}... Generation will be available shortly.</span>
      </div>
    );
  } else if (data && (!data.dit_model_loaded || !data.lm_model_loaded)) {
    const isDownloading = data.init_stage === "downloading";
    const pct = Math.round(data.download_progress * 100);
    let label: string;
    if (isDownloading) {
      label = `Downloading AI models${pct > 0 ? ` — ${pct}%` : ""}...`;
    } else if (data.init_stage === "loading_dit") {
      label = "Loading DiT model...";
    } else if (data.init_stage === "loading_lm") {
      label = "Loading language model...";
    } else if (data.init_stage === "loading_heartmula") {
      label = "Loading HeartMuLa model...";
    } else if (!data.dit_model_loaded) {
      label = "Loading AI models...";
    } else {
      label = "Loading language model...";
    }
    bannerContent = (
      <div className="flex items-center gap-2 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <div className="flex-1 min-w-0">
          <span>{label} Generation will be available shortly.</span>
          {isDownloading && pct > 0 && (
            <div className="mt-1 h-1 w-full max-w-md rounded-full bg-yellow-500/20">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-[2s] ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Keep last content around so it stays visible during fade-out
  if (bannerContent) {
    lastContent.current = bannerContent;
  }

  const isShowing = bannerContent !== null;

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isShowing ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
      }`}
    >
      {lastContent.current}
    </div>
  );
}
