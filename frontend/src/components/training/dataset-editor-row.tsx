"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipLabel } from "@/components/ui/tooltip-label";
import type { DatasetSample } from "@/types/api";

interface DatasetEditorRowProps {
  sample: DatasetSample;
  onChange: (updated: DatasetSample) => void;
  readOnly?: boolean;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DatasetEditorRow({ sample, onChange, readOnly = false }: DatasetEditorRowProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (partial: Partial<DatasetSample>) =>
    onChange({ ...sample, ...partial });

  return (
    <div className="rounded-md border">
      <div className="grid grid-cols-[1fr_1.5fr_1fr_70px_70px_90px_50px_36px] items-center gap-2 p-2">
        {/* Filename */}
        <div
          className="truncate text-xs text-muted-foreground"
          title={sample.filename}
        >
          {sample.filename}
          {sample.duration !== null && (
            <span className="ml-1 opacity-60">
              ({formatDuration(sample.duration)})
            </span>
          )}
        </div>

        {/* Caption */}
        <Input
          className="h-7 text-xs"
          placeholder="Caption"
          value={sample.caption}
          onChange={(e) => update({ caption: e.target.value })}
          disabled={readOnly}
        />

        {/* Genre */}
        <Input
          className="h-7 text-xs"
          placeholder="Genre"
          value={sample.genre}
          onChange={(e) => update({ genre: e.target.value })}
          disabled={readOnly}
        />

        {/* BPM */}
        <Input
          className="h-7 text-xs"
          type="number"
          placeholder="BPM"
          value={sample.bpm ?? ""}
          onChange={(e) =>
            update({
              bpm: e.target.value ? parseInt(e.target.value, 10) : null,
            })
          }
          disabled={readOnly}
        />

        {/* Key */}
        <Input
          className="h-7 text-xs"
          placeholder="Key"
          value={sample.keyscale}
          onChange={(e) => update({ keyscale: e.target.value })}
          disabled={readOnly}
        />

        {/* Time Signature */}
        <Select
          value={sample.timesignature || "none"}
          onValueChange={(v) =>
            update({ timesignature: v === "none" ? "" : v })
          }
          disabled={readOnly}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">--</SelectItem>
            <SelectItem value="4/4">4/4</SelectItem>
            <SelectItem value="3/4">3/4</SelectItem>
            <SelectItem value="6/8">6/8</SelectItem>
          </SelectContent>
        </Select>

        {/* Instrumental toggle */}
        <Switch
          checked={sample.is_instrumental}
          onCheckedChange={(v) =>
            update({
              is_instrumental: v,
              lyrics: v ? "[Instrumental]" : sample.lyrics === "[Instrumental]" ? "" : sample.lyrics,
            })
          }
          aria-label="Instrumental"
          disabled={readOnly}
        />

        {/* Expand button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setExpanded(!expanded)}
          aria-label="Expand row"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Expanded section: lyrics, custom_tag, prompt_override */}
      {expanded && (
        <div className="space-y-3 border-t px-3 py-3">
          <div className="space-y-1">
            <TooltipLabel tooltip="Lyrics for this track. Include structural tags like [Verse], [Chorus], [Bridge] to help the model learn song structure.">
              Lyrics
            </TooltipLabel>
            <Textarea
              className="min-h-[80px] text-xs"
              placeholder="Enter lyrics..."
              value={sample.lyrics}
              onChange={(e) => update({ lyrics: e.target.value })}
              disabled={readOnly || sample.is_instrumental}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <TooltipLabel tooltip="Per-sample trigger word. Overrides the dataset-level trigger word for this specific track. Leave blank to use the dataset default.">
                Custom Tag
              </TooltipLabel>
              <Input
                className="h-7 text-xs"
                placeholder="Override trigger word"
                value={sample.custom_tag}
                onChange={(e) => update({ custom_tag: e.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1">
              <TooltipLabel tooltip="Force this sample to always use Caption or Genre as its text prompt, ignoring the Genre Ratio setting. Auto = follow the ratio.">
                Prompt Override
              </TooltipLabel>
              <Select
                value={sample.prompt_override ?? "auto"}
                onValueChange={(v) =>
                  update({ prompt_override: v === "auto" ? null : v })
                }
                disabled={readOnly}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="caption">Caption</SelectItem>
                  <SelectItem value="genre">Genre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
