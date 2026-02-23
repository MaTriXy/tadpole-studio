"use client";

import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipLabel } from "@/components/ui/tooltip-label";
import type { DatasetLevelMetadata } from "@/types/api";

interface DatasetMetadataFormProps {
  metadata: DatasetLevelMetadata;
  onChange: (metadata: DatasetLevelMetadata) => void;
  readOnly?: boolean;
}

export function DatasetMetadataForm({
  metadata,
  onChange,
  readOnly = false,
}: DatasetMetadataFormProps) {
  const update = (partial: Partial<DatasetLevelMetadata>) =>
    onChange({ ...metadata, ...partial });

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h4 className="text-sm font-medium">Dataset Settings</h4>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <TooltipLabel tooltip="A unique token the model learns to associate with your style (e.g. 'sks'). Gets added to every sample's caption/genre. Per-sample tags override this.">
            Trigger Word
          </TooltipLabel>
          <Input
            placeholder="e.g. sks, myvoice"
            value={metadata.custom_tag}
            onChange={(e) => update({ custom_tag: e.target.value })}
            disabled={readOnly}
          />
        </div>

        <div className="space-y-2">
          <TooltipLabel tooltip="Where the trigger word is placed. Prepend = before caption, Append = after caption, Replace = trigger word replaces the caption entirely.">
            Tag Position
          </TooltipLabel>
          <Select
            value={metadata.tag_position}
            onValueChange={(v) =>
              update({ tag_position: v as DatasetLevelMetadata["tag_position"] })
            }
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prepend">Prepend</SelectItem>
              <SelectItem value="append">Append</SelectItem>
              <SelectItem value="replace">Replace</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <TooltipLabel tooltip="% of samples that use the Genre field instead of Caption as their text prompt. Recommended: 0 — captions are more descriptive than genre labels.">
            Genre Ratio: {metadata.genre_ratio}%
          </TooltipLabel>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[metadata.genre_ratio]}
            onValueChange={(v) => update({ genre_ratio: v[0] })}
            disabled={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
