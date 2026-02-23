"use client";

import { Repeat, Save, HelpCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useGenerationStore } from "@/stores/generation-store";

export function AutoGenControls() {
  const autoGenEnabled = useGenerationStore((s) => s.autoGenEnabled);
  const autoSaveEnabled = useGenerationStore((s) => s.autoSaveEnabled);
  const autoGenCount = useGenerationStore((s) => s.autoGenCount);
  const autoGenMaxRuns = useGenerationStore((s) => s.autoGenMaxRuns);
  const setAutoGenEnabled = useGenerationStore((s) => s.setAutoGenEnabled);
  const setAutoSaveEnabled = useGenerationStore((s) => s.setAutoSaveEnabled);
  const setAutoGenMaxRuns = useGenerationStore((s) => s.setAutoGenMaxRuns);
  const resetAutoGenCount = useGenerationStore((s) => s.resetAutoGenCount);
  const autoTitleEnabled = useGenerationStore((s) => s.autoTitleEnabled);
  const customTitle = useGenerationStore((s) => s.customTitle);
  const setAutoTitleEnabled = useGenerationStore((s) => s.setAutoTitleEnabled);
  const setCustomTitle = useGenerationStore((s) => s.setCustomTitle);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Auto-Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="auto-title" className="text-sm font-medium">
              Auto-Title
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>LLM generates a creative title when on. Type your own when off.</TooltipContent>
            </Tooltip>
          </div>
          <Switch
            id="auto-title"
            checked={autoTitleEnabled}
            onCheckedChange={setAutoTitleEnabled}
          />
        </div>

        {!autoTitleEnabled && (
          <div className="pl-6">
            <Input
              placeholder="Enter a custom title..."
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* Auto-Generate */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="auto-gen" className="text-sm font-medium">
              Auto-Generate
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Automatically re-run generation after completion</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            {autoGenEnabled && autoGenCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className="cursor-pointer text-xs"
                    onClick={resetAutoGenCount}
                  >
                    {autoGenCount}
                    {autoGenMaxRuns > 0 ? ` / ${autoGenMaxRuns}` : ""}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Click to reset counter</TooltipContent>
              </Tooltip>
            )}
            <Switch
              id="auto-gen"
              checked={autoGenEnabled}
              onCheckedChange={setAutoGenEnabled}
            />
          </div>
        </div>

        {autoGenEnabled && (
          <div className="flex items-center gap-2 pl-6">
            <Label htmlFor="max-runs" className="text-xs text-muted-foreground whitespace-nowrap">
              Max runs
            </Label>
            <Input
              id="max-runs"
              type="number"
              min={0}
              value={autoGenMaxRuns}
              onChange={(e) => setAutoGenMaxRuns(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-7 w-20 text-xs"
              placeholder="0 = unlimited"
            />
            <span className="text-xs text-muted-foreground">0 = unlimited</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Save className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="auto-save" className="text-sm font-medium">
              Auto-Save to Library
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Save every result to your library automatically</TooltipContent>
            </Tooltip>
          </div>
          <Switch
            id="auto-save"
            checked={autoSaveEnabled}
            onCheckedChange={setAutoSaveEnabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
