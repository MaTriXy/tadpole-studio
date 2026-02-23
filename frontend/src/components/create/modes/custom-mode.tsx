"use client";

import { CaptionInput } from "@/components/create/caption-input";
import { LyricsEditor } from "@/components/create/lyrics-editor";
import { MetadataControls } from "@/components/create/metadata-controls";
import { useGenerationStore } from "@/stores/generation-store";

interface CustomModeProps {
  formatCaption: () => Promise<void>;
  isFormatting: boolean;
  canFormat: boolean;
}

export function CustomMode({ formatCaption, isFormatting, canFormat }: CustomModeProps) {
  const form = useGenerationStore((s) => s.customForm);
  const update = useGenerationStore((s) => s.updateCustomForm);

  return (
    <div className="space-y-4">
      <CaptionInput
        value={form.caption}
        onChange={(v) => update({ caption: v })}
        showFormat
        onFormat={formatCaption}
        isFormatting={isFormatting}
        canFormat={canFormat}
      />

      <LyricsEditor
        value={form.lyrics}
        onChange={(v) => update({ lyrics: v })}
        disabled={form.instrumental}
      />

      <MetadataControls
        bpm={form.bpm}
        onBpmChange={(v) => update({ bpm: v })}
        keyscale={form.keyscale}
        onKeyscaleChange={(v) => update({ keyscale: v === "_auto" ? "" : v })}
        timesignature={form.timesignature}
        onTimesignatureChange={(v) => update({ timesignature: v === "_auto" ? "" : v })}
        duration={form.duration}
        onDurationChange={(v) => update({ duration: v })}
        language={form.language}
        onLanguageChange={(v) => update({ language: v })}
        instrumental={form.instrumental}
        onInstrumentalChange={(v) => update({ instrumental: v })}
      />
    </div>
  );
}
