"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VALID_LANGUAGES,
  KEYSCALE_NOTES,
  KEYSCALE_ACCIDENTALS,
  KEYSCALE_MODES,
  VALID_TIME_SIGNATURES,
  BPM_MIN,
  BPM_MAX,
  DURATION_MIN,
  DURATION_DEFAULT,
} from "@/lib/constants";
import { useActiveBackend } from "@/hooks/use-active-backend";

interface MetadataControlsProps {
  bpm: number | null;
  onBpmChange: (bpm: number | null) => void;
  keyscale: string;
  onKeyscaleChange: (keyscale: string) => void;
  timesignature: string;
  onTimesignatureChange: (timesig: string) => void;
  duration: number | null;
  onDurationChange: (duration: number | null) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  instrumental: boolean;
  onInstrumentalChange: (instrumental: boolean) => void;
}

function buildKeyscaleOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [
    { value: "", label: "Auto" },
  ];
  for (const note of KEYSCALE_NOTES) {
    for (const acc of KEYSCALE_ACCIDENTALS) {
      for (const mode of KEYSCALE_MODES) {
        const val = `${note}${acc} ${mode}`;
        options.push({ value: val, label: val });
      }
    }
  }
  return options;
}

const keyscaleOptions = buildKeyscaleOptions();

export function MetadataControls({
  bpm,
  onBpmChange,
  keyscale,
  onKeyscaleChange,
  timesignature,
  onTimesignatureChange,
  duration,
  onDurationChange,
  language,
  onLanguageChange,
  instrumental,
  onInstrumentalChange,
}: MetadataControlsProps) {
  const { capabilities } = useActiveBackend();
  const maxDuration = capabilities.max_duration_seconds;

  return (
    <div className="space-y-4">
      {/* BPM - hidden when backend doesn't support it */}
      {capabilities.supports_bpm_control && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>BPM</Label>
            <span className="text-xs text-muted-foreground">
              {bpm ?? "Auto"}
            </span>
          </div>
          <Slider
            value={[bpm ?? 120]}
            min={BPM_MIN}
            max={BPM_MAX}
            step={1}
            onValueChange={([v]) => onBpmChange(v)}
          />
        </div>
      )}

      {/* Duration */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Duration</Label>
          <span className="text-xs text-muted-foreground">
            {duration !== null ? `${duration}s` : "Auto"}
            {maxDuration < 600 && (
              <span className="ml-1 text-muted-foreground/60">(max {maxDuration}s)</span>
            )}
          </span>
        </div>
        <Slider
          value={[duration ?? DURATION_DEFAULT]}
          min={DURATION_MIN}
          max={maxDuration}
          step={1}
          disabled={duration === null}
          onValueChange={([v]) => onDurationChange(Math.min(v, maxDuration))}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onDurationChange(duration === null ? DURATION_DEFAULT : null)}
            >
              {duration === null ? "Set manual duration" : "Use auto duration"}
            </button>
          </TooltipTrigger>
          <TooltipContent>Let the model choose an appropriate duration</TooltipContent>
        </Tooltip>
      </div>

      {/* Key / Time Signature row - conditional */}
      {(capabilities.supports_keyscale_control || capabilities.supports_timesignature_control) && (
        <div className="grid grid-cols-2 gap-3">
          {capabilities.supports_keyscale_control && (
            <div className="space-y-2">
              <Label>Key</Label>
              <Select value={keyscale} onValueChange={onKeyscaleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto" />
                </SelectTrigger>
                <SelectContent>
                  {keyscaleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value || "_auto"}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {capabilities.supports_timesignature_control && (
            <div className="space-y-2">
              <Label>Time Signature</Label>
              <Select value={timesignature} onValueChange={onTimesignatureChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_auto">Auto</SelectItem>
                  {VALID_TIME_SIGNATURES.map((ts) => (
                    <SelectItem key={ts} value={ts}>
                      {ts}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Language / Instrumental row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={language} onValueChange={onLanguageChange}>
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

        {capabilities.supports_instrumental_toggle && (
          <div className="flex items-end gap-2 pb-1">
            <Switch
              id="instrumental"
              checked={instrumental}
              onCheckedChange={onInstrumentalChange}
            />
            <Label htmlFor="instrumental" className="cursor-pointer">
              Instrumental
            </Label>
          </div>
        )}
      </div>
    </div>
  );
}
