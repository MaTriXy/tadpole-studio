"use client";

import { useGenerationStore } from "@/stores/generation-store";
import { useGeneration } from "@/hooks/use-generation";
import { ModeSelector } from "./mode-selector";
import { SimpleMode } from "./modes/simple-mode";
import { CustomMode } from "./modes/custom-mode";
import { RemixMode } from "./modes/remix-mode";
import { RepaintMode } from "./modes/repaint-mode";
import { ExtractMode } from "./modes/extract-mode";
import { LegoMode } from "./modes/lego-mode";
import { CompleteMode } from "./modes/complete-mode";
import { AdvancedSettings } from "./advanced-settings";
import { GenerateButton } from "./generate-button";
import { AutoGenControls } from "./auto-gen-controls";

export function GenerationForm() {
  const activeMode = useGenerationStore((s) => s.activeMode);
  const isCancelling = useGenerationStore((s) =>
    s.activeJobs.some((j) => j.status === "cancelling"),
  );
  const { submit, canSubmit, isGenerating, formatCaption, isFormatting, canFormat } = useGeneration();

  return (
    <div className="space-y-4">
      <ModeSelector />

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        {activeMode === "Simple" && <SimpleMode />}
        {activeMode === "Custom" && <CustomMode formatCaption={formatCaption} isFormatting={isFormatting} canFormat={canFormat} />}
        {activeMode === "Remix" && <RemixMode />}
        {activeMode === "Repaint" && <RepaintMode />}
        {activeMode === "Extract" && <ExtractMode />}
        {activeMode === "Lego" && <LegoMode />}
        {activeMode === "Complete" && <CompleteMode />}
      </div>

      <AdvancedSettings />

      <GenerateButton
        onClick={submit}
        disabled={!canSubmit}
        isGenerating={isGenerating}
        isCancelling={isCancelling}
      />

      <AutoGenControls />
    </div>
  );
}
