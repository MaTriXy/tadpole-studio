"use client";

import { Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DatasetSample } from "@/types/api";
import { DatasetEditorRow } from "./dataset-editor-row";

interface DatasetEditorTableProps {
  samples: DatasetSample[];
  onChange: (samples: DatasetSample[]) => void;
  readOnly?: boolean;
}

function HeaderTip({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {label}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64">
            {tip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

export function DatasetEditorTable({
  samples,
  onChange,
  readOnly = false,
}: DatasetEditorTableProps) {
  const handleRowChange = (index: number, updated: DatasetSample) => {
    const next = samples.map((s, i) => (i === index ? updated : s));
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_1.5fr_1fr_70px_70px_90px_50px_36px] gap-2 px-2 text-xs font-medium text-muted-foreground">
        <span>File</span>
        <HeaderTip
          label="Caption"
          tip="Full natural language description of the track. This is the primary text the model learns from. e.g. 'moody electronic pop with distorted guitars and melancholic vocals'"
        />
        <HeaderTip
          label="Genre"
          tip="Short genre/style labels. Comma-separated is fine, e.g. 'electropop, grunge, sadcore'. Only used when Genre Ratio > 0% or Prompt Override is set to Genre."
        />
        <HeaderTip
          label="BPM"
          tip="Beats per minute. Use a tool like Key-BPM-Finder for accuracy rather than guessing."
        />
        <HeaderTip
          label="Key"
          tip="Musical key, e.g. 'C major', 'Ab minor'. Use a key detection tool for accuracy."
        />
        <span>Time Sig</span>
        <span title="Instrumental">Inst</span>
        <span />
      </div>

      {/* Scrollable rows */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-1 pr-3">
          {samples.map((sample, idx) => (
            <DatasetEditorRow
              key={sample.audio_path}
              sample={sample}
              onChange={(updated) => handleRowChange(idx, updated)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </ScrollArea>

      <p className="text-xs text-muted-foreground">
        {samples.length} sample{samples.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
