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
import { useGenerationStore } from "@/stores/generation-store";
import { VALID_TRACK_NAMES } from "@/lib/constants";

export function ExtractMode() {
  const form = useGenerationStore((s) => s.extractForm);
  const update = useGenerationStore((s) => s.updateExtractForm);

  return (
    <div className="space-y-4">
      <AudioUploadZone
        filePath={form.audioFilePath}
        fileName={form.audioFileName}
        onUpload={(path, name) =>
          update({ audioFilePath: path, audioFileName: name })
        }
        onRemove={() =>
          update({ audioFilePath: "", audioFileName: "", audioPreviewUrl: "" })
        }
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

      <div className="space-y-2">
        <Label>Track to Extract</Label>
        <Select
          value={form.trackName}
          onValueChange={(v) => update({ trackName: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a track..." />
          </SelectTrigger>
          <SelectContent>
            {VALID_TRACK_NAMES.map((track) => (
              <SelectItem key={track.value} value={track.value}>
                {track.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CaptionInput
        value={form.caption}
        onChange={(v) => update({ caption: v })}
      />
    </div>
  );
}
