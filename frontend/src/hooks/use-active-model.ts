"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/lib/api/client";
import type { GenerationMode } from "@/stores/generation-store";

export type ModelType = "base" | "sft" | "turbo" | "unknown";

export interface ActiveModelInfo {
  modelName: string;
  modelType: ModelType;
  supportedModes: GenerationMode[];
  supportsCfg: boolean;
  isLoaded: boolean;
}

const BASE_MODES: GenerationMode[] = [
  "Simple", "Custom", "Remix", "Repaint", "Extract", "Lego", "Complete",
];
const STANDARD_MODES: GenerationMode[] = [
  "Simple", "Custom", "Remix", "Repaint",
];

function detectModelType(ditModel: string): ModelType {
  const lower = ditModel.toLowerCase();
  if (lower.includes("turbo")) return "turbo";
  if (lower.includes("sft")) return "sft";
  if (lower.includes("base")) return "base";
  return "unknown";
}

export function useActiveModel(): ActiveModelInfo {
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 5_000,
    retry: false,
  });

  const activeBackend = data?.active_backend ?? "ace-step";

  // When HeartMuLa is active, only Simple and Custom are supported
  if (activeBackend === "heartmula") {
    return {
      modelName: "heartmula",
      modelType: "unknown",
      supportedModes: ["Simple", "Custom"],
      supportsCfg: false,
      isLoaded: true,
    };
  }

  const modelName = data?.dit_model ?? "";
  const modelType = modelName ? detectModelType(modelName) : "unknown";
  const isLoaded = data?.dit_model_loaded ?? false;

  const supportedModes = modelType === "base" ? BASE_MODES : STANDARD_MODES;
  const supportsCfg = modelType !== "turbo" && modelType !== "unknown";

  return {
    modelName,
    modelType,
    supportedModes,
    supportsCfg,
    isLoaded,
  };
}
