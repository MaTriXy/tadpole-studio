"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { switchDitModel, switchLmModel, switchBackend, downloadModel } from "@/lib/api/client";
import type { ModelInfo, AvailableModel, BackendType } from "@/types/api";
import { useEngineSwitchStore } from "@/stores/engine-switch-store";

const MODEL_DESCRIPTIONS: Record<string, string> = {
  "acestep-v15-base":
    "Base model. 50 steps, CFG-guided. All modes: Text2Music, Remix, Repaint, Extract, Lego, Complete. Medium quality, high diversity.",
  "acestep-v15-sft":
    "SFT-tuned. 50 steps, CFG-guided. Text2Music, Remix, Repaint. High quality, medium diversity.",
  "acestep-v15-turbo":
    "Turbo. 8 steps, no CFG needed. Text2Music, Remix, Repaint. Very high quality, medium diversity.",
  "acestep-v15-turbo-rl":
    "RL-tuned turbo. 8 steps, no CFG needed. Text2Music, Remix, Repaint. Very high quality, medium diversity.",
  "acestep-5Hz-lm-0.6B":
    "Based on Qwen3-0.6B. Lightweight (6-8GB VRAM). Medium audio understanding and composition.",
  "acestep-5Hz-lm-1.7B":
    "Based on Qwen3-1.7B. Balanced (8-16GB VRAM). Medium capabilities, better melody copying.",
  "acestep-5Hz-lm-4B":
    "Based on Qwen3-4B. Best quality (24GB+ VRAM). Strong audio understanding, composition, and melody.",
  "acestep-v15-turbo-shift3":
    "Turbo DiT variant with shift=3.",
  "acestep-v15-turbo-shift1":
    "Turbo DiT variant with shift=1.",
  "acestep-v15-turbo-continuous":
    "Turbo DiT with continuous noise schedule.",
  "HeartMuLa-oss-3B":
    "A music language model that generates music conditioned on lyrics and tags with multilingual support covering almost all languages.",
  "HeartCodec-oss":
    "12.5 Hz music codec with high reconstruction fidelity.",
};

const CHAT_LLM_DESCRIPTIONS: Record<string, string> = {
  "Qwen2.5-1.5B-Instruct-4bit":
    "Recommended. Strong instruction following for its size. 869 MB.",
  "Qwen3-0.6B-4bit":
    "Ultra-lightweight alternative. 335 MB.",
};

interface ModelCardsProps {
  title: string;
  models: ModelInfo[];
  availableModels?: AvailableModel[];
  modelType: "dit" | "lm" | "chat_llm" | "heartmula";
  associatedBackend?: BackendType;
  activeBackend?: BackendType;
  onEngineSwitch?: () => void;
  /** Model name to show a loading spinner on (e.g. auto-selecting LM) */
  loadingModelName?: string | null;
}

export function ModelCards({
  title,
  models,
  availableModels = [],
  modelType,
  associatedBackend,
  activeBackend,
  onEngineSwitch,
  loadingModelName,
}: ModelCardsProps) {
  const queryClient = useQueryClient();
  const startSwitch = useEngineSwitchStore((s) => s.startSwitch);

  const switchModelMutation = useMutation({
    mutationFn: (name: string) => {
      if (modelType === "dit") return switchDitModel(name);
      if (modelType === "lm") return switchLmModel(name);
      throw new Error(`Cannot switch model for type: ${modelType}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["models"] });
      queryClient.invalidateQueries({ queryKey: ["health"] });
    },
    onError: (err) => toast.error(`Switch failed: ${err.message}`),
  });

  const switchBackendMutation = useMutation({
    mutationFn: switchBackend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backends"] });
      queryClient.invalidateQueries({ queryKey: ["health"] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to switch engine: ${err.message}`);
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (name: string) => downloadModel(name),
    onSuccess: (_data, name) => {
      toast.success(`Download started for ${name}`);
      queryClient.invalidateQueries({ queryKey: ["available-models"] });
    },
    onError: (err) => toast.error(`Download failed: ${err.message}`),
  });

  const handleSwitch = async (modelName: string) => {
    if (associatedBackend && activeBackend !== associatedBackend) {
      startSwitch(associatedBackend);
    }
    try {
      await switchModelMutation.mutateAsync(modelName);
      // Also switch backend if needed
      if (associatedBackend && activeBackend !== associatedBackend) {
        switchBackendMutation.mutate(associatedBackend);
        onEngineSwitch?.();
      }
    } catch {
      // Error already handled by onError callback
    }
  };

  const handleActivate = () => {
    if (associatedBackend && activeBackend !== associatedBackend) {
      startSwitch(associatedBackend);
      switchBackendMutation.mutate(associatedBackend);
    }
  };

  const isHeartmula = modelType === "heartmula";
  const isChatLlm = modelType === "chat_llm";
  const isEngineActive = associatedBackend === activeBackend;
  const engineSwitchInProgress = useEngineSwitchStore((s) => s.switchingTo) !== null;
  const isSwitching = switchModelMutation.isPending || switchBackendMutation.isPending || engineSwitchInProgress;

  // Build a combined list: installed models first, then not-installed available models
  // Keep downloading models visible even if their directory already exists
  const installedNames = new Set(models.map((m) => m.name));
  const notInstalledAvailable = availableModels.filter(
    (am) => am.downloading || (!am.installed && !installedNames.has(am.name)),
  );

  // When nested inside an engine group card, render without the outer Card wrapper
  const useInnerLayout = !!associatedBackend;

  const content = (
    <>
      {models.length === 0 && notInstalledAvailable.length === 0 ? (
        <p className="text-sm text-muted-foreground">No models found</p>
      ) : (
        <>
          {models.map((model) => {
            // HeartMuLa models are all active when the engine is active (no individual selection)
            const showActive = isHeartmula ? isEngineActive : model.is_active && isEngineActive;

            return (
              <div
                key={model.name}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  {MODEL_DESCRIPTIONS[model.name] ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium cursor-help">{model.name}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        {MODEL_DESCRIPTIONS[model.name]}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-sm font-medium">{model.name}</span>
                  )}
                </div>
                {showActive ? (
                  <Button variant="outline" size="sm" className="pointer-events-none text-green-500 border-green-500/30">
                    Selected
                    <Check className="ml-1 h-3 w-3" />
                  </Button>
                ) : !isChatLlm && !(isHeartmula && isEngineActive) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      isHeartmula ? handleActivate() : handleSwitch(model.name)
                    }
                    disabled={isSwitching}
                  >
                    {(isSwitching &&
                      (isHeartmula || switchModelMutation.variables === model.name || loadingModelName === model.name)) && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                    {isHeartmula ? "Activate" : "Switch"}
                  </Button>
                ) : null}
              </div>
            );
          })}

          {notInstalledAvailable.map((am) => {
            const tooltipText = [
              MODEL_DESCRIPTIONS[am.name] || CHAT_LLM_DESCRIPTIONS[am.name] || am.description,
              am.size_mb > 0
                ? `~${am.size_mb >= 1000 ? `${(am.size_mb / 1000).toFixed(1)} GB` : `${am.size_mb} MB`} download.`
                : "",
            ]
              .filter(Boolean)
              .join(" ");
            const pct = Math.round(am.download_progress * 100);

            return (
              <div
                key={am.name}
                className="rounded-lg border border-dashed border-border p-3 opacity-75"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {tooltipText ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm font-medium cursor-help">{am.name}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {tooltipText}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-sm font-medium">{am.name}</span>
                    )}
                    {am.downloading ? (
                      <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400">
                        Downloading{pct > 0 ? ` ${pct}%` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not installed
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadMutation.mutate(am.name)}
                    disabled={am.downloading || (downloadMutation.isPending && downloadMutation.variables === am.name)}
                  >
                    {(am.downloading || (downloadMutation.isPending && downloadMutation.variables === am.name)) ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="mr-1 h-3 w-3" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
                {am.downloading && (
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </>
  );

  if (useInnerLayout) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="space-y-2">{content}</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{content}</CardContent>
    </Card>
  );
}
