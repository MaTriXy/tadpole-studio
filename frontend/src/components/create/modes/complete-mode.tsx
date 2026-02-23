"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AudioUploadZone } from "@/components/create/audio-upload-zone";
import { CaptionInput } from "@/components/create/caption-input";
import { LyricsEditor } from "@/components/create/lyrics-editor";
import { useGenerationStore } from "@/stores/generation-store";
import { VALID_TRACK_NAMES, VALID_LANGUAGES } from "@/lib/constants";

export function CompleteMode() {
  const form = useGenerationStore((s) => s.completeForm);
  const update = useGenerationStore((s) => s.updateCompleteForm);

  const toggleTrackClass = (value: string) => {
    const current = form.completeTrackClasses;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    update({ completeTrackClasses: next });
  };

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

      <div className="space-y-2">
        <Label>Track Classes to Add</Label>
        <div className="grid grid-cols-3 gap-2">
          {VALID_TRACK_NAMES.map((track) => (
            <label
              key={track.value}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={form.completeTrackClasses.includes(track.value)}
                onCheckedChange={() => toggleTrackClass(track.value)}
              />
              {track.label}
            </label>
          ))}
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
        <Select
          value={form.language}
          onValueChange={(v) => update({ language: v })}
        >
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
