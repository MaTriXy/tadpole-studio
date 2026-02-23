"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBackends } from "@/lib/api/client";
import type { BackendType, BackendCapabilities, BackendInfo } from "@/types/api";

const DEFAULT_CAPABILITIES: BackendCapabilities = {
  supported_task_types: ["text2music", "music2music", "repainting", "cover", "repaint", "extract", "lego", "complete"],
  supports_batch: true,
  supports_progress_callback: true,
  supported_audio_formats: ["flac", "mp3", "wav"],
  max_duration_seconds: 600,
  supports_bpm_control: true,
  supports_keyscale_control: true,
  supports_timesignature_control: true,
  supports_instrumental_toggle: true,
  supports_thinking: true,
  supports_seed: true,
};

export interface ActiveBackendInfo {
  activeBackend: BackendType;
  capabilities: BackendCapabilities;
  isReady: boolean;
  backends: BackendInfo[];
  isLoading: boolean;
}

export function useActiveBackend(): ActiveBackendInfo {
  const { data, isLoading } = useQuery({
    queryKey: ["backends"],
    queryFn: fetchBackends,
    refetchInterval: (query) => {
      const active = query.state.data?.backends.find(
        (b) => b.backend_type === query.state.data?.active_backend
      );
      // Poll faster while active backend is loading
      return active && !active.ready ? 3_000 : 10_000;
    },
    retry: false,
  });

  const activeBackend: BackendType = data?.active_backend ?? "ace-step";
  const activeInfo = data?.backends.find((b) => b.backend_type === activeBackend);

  return {
    activeBackend,
    capabilities: activeInfo?.capabilities ?? DEFAULT_CAPABILITIES,
    isReady: activeInfo?.ready ?? false,
    backends: data?.backends ?? [],
    isLoading,
  };
}
