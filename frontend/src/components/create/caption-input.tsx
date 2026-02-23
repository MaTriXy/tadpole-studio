"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Wand2, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useActiveBackend } from "@/hooks/use-active-backend";

interface CaptionInputProps {
  value: string;
  onChange: (value: string) => void;
  showFormat?: boolean;
  onFormat?: () => void;
  isFormatting?: boolean;
  canFormat?: boolean;
}

export function CaptionInput({
  value,
  onChange,
  showFormat = false,
  onFormat,
  isFormatting = false,
  canFormat = false,
}: CaptionInputProps) {
  const { activeBackend } = useActiveBackend();
  const isHeartMuLa = activeBackend === "heartmula";
  const label = isHeartMuLa ? "Tags" : "Caption";
  const placeholder = isHeartMuLa
    ? "piano, happy, wedding, pop, 120bpm..."
    : "Describe the music you want to create... (e.g., 'An upbeat pop song with catchy guitar riffs and energetic vocals')";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="caption">{label}</Label>
        {showFormat && !isHeartMuLa && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onFormat}
                disabled={!canFormat || isFormatting}
                className="h-7 gap-1.5 text-xs"
              >
                {isFormatting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Wand2 className="h-3 w-3" />
                )}
                Format
              </Button>
            </TooltipTrigger>
            <TooltipContent>Use AI to enhance your caption and lyrics</TooltipContent>
          </Tooltip>
        )}
      </div>
      <Textarea
        id="caption"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[80px] resize-none"
      />
    </div>
  );
}
