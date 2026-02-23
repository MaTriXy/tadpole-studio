"use client";

import { useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useGenerationStore, type GenerationMode } from "@/stores/generation-store";
import { useActiveModel } from "@/hooks/use-active-model";
import { useActiveBackend } from "@/hooks/use-active-backend";
import { MODE_TO_TASK_TYPE } from "@/lib/constants";

const MODES: GenerationMode[] = [
  "Simple",
  "Custom",
  "Remix",
  "Repaint",
  "Extract",
  "Lego",
  "Complete",
];

export function ModeSelector() {
  const activeMode = useGenerationStore((s) => s.activeMode);
  const setActiveMode = useGenerationStore((s) => s.setActiveMode);
  const { supportedModes: modelSupportedModes } = useActiveModel();
  const { capabilities } = useActiveBackend();

  // Filter modes by both model support and backend capabilities
  const supportedModes = modelSupportedModes.filter((mode) => {
    const taskType = MODE_TO_TASK_TYPE[mode];
    return taskType ? capabilities.supported_task_types.includes(taskType) : true;
  });

  // Auto-switch to Custom if current mode becomes unsupported
  useEffect(() => {
    if (!supportedModes.includes(activeMode)) {
      setActiveMode("Custom");
    }
  }, [activeMode, supportedModes, setActiveMode]);

  return (
    <Tabs
      value={activeMode}
      onValueChange={(v) => setActiveMode(v as GenerationMode)}
    >
      <TabsList className="w-full">
        {MODES.map((mode) => {
          const supported = supportedModes.includes(mode);

          if (!supported) {
            const taskType = MODE_TO_TASK_TYPE[mode];
            const isBackendLimit = taskType && !capabilities.supported_task_types.includes(taskType);
            const tooltip = isBackendLimit
              ? "Not supported by this backend"
              : "Requires base model";

            return (
              <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <span className="flex-1">
                    <TabsTrigger
                      value={mode}
                      className="w-full opacity-40 pointer-events-none"
                      disabled
                    >
                      {mode}
                    </TabsTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{tooltip}</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <TabsTrigger key={mode} value={mode} className="flex-1">
              {mode}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
