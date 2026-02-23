"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AudioUploadZone } from "@/components/create/audio-upload-zone";
import { WaveformRegionPicker } from "@/components/create/waveform-region-picker";
import { CaptionInput } from "@/components/create/caption-input";
import { LyricsEditor } from "@/components/create/lyrics-editor";
import { useGenerationStore } from "@/stores/generation-store";
import { VALID_LANGUAGES } from "@/lib/constants";

export function RepaintMode() {
  const form = useGenerationStore((s) => s.repaintForm);
  const update = useGenerationStore((s) => s.updateRepaintForm);

  return (
    <div className="space-y-4">
      <AudioUploadZone
        filePath={form.audioFilePath}
        fileName={form.audioFileName}
        onUpload={(path, name) =>
          update({ audioFilePath: path, audioFileName: name })
        }
        onRemove={() => update({ audioFilePath: "", audioFileName: "" })}
      />

      {form.audioPreviewUrl && (
        <WaveformRegionPicker
          audioUrl={form.audioPreviewUrl}
          startTime={form.repaintingStart}
          endTime={form.repaintingEnd}
          onTimeChange={(start, end) =>
            update({ repaintingStart: start, repaintingEnd: end })
          }
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Start Time (s)</Label>
          <Input
            type="number"
            value={form.repaintingStart}
            onChange={(e) =>
              update({ repaintingStart: parseFloat(e.target.value) || 0 })
            }
            min={0}
            step={0.1}
            className="h-8"
          />
        </div>
        <div className="space-y-2">
          <Label>End Time (s)</Label>
          <Input
            type="number"
            value={form.repaintingEnd}
            onChange={(e) =>
              update({ repaintingEnd: parseFloat(e.target.value) || -1 })
            }
            step={0.1}
            className="h-8"
            placeholder="-1 for end"
          />
        </div>
      </div>

      <CaptionInput
        value={form.caption}
        onChange={(v) => update({ caption: v })}
      />

      <LyricsEditor
        value={form.lyrics}
        onChange={(v) => update({ lyrics: v })}
      />

      <div className="space-y-2">
        <Label>Language</Label>
        <Select value={form.language} onValueChange={(v) => update({ language: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VALID_LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
