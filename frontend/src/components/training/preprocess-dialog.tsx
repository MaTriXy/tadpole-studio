"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TooltipLabel } from "@/components/ui/tooltip-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startPreprocess } from "@/lib/api/client";
import { useTrainingStore } from "@/stores/training-store";

interface PreprocessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill from an existing dataset config. */
  configName?: string;
  /** Audio directory from the config. */
  audioDir?: string;
}

export function PreprocessDialog({
  open,
  onOpenChange,
  configName: initialConfigName,
  audioDir: initialAudioDir,
}: PreprocessDialogProps) {
  const queryClient = useQueryClient();
  const setStatus = useTrainingStore((s) => s.setStatus);
  const [audioDir, setAudioDir] = useState("");
  const [outputName, setOutputName] = useState("");
  const [variant, setVariant] = useState("turbo");
  const [maxDuration, setMaxDuration] = useState(240);

  // Sync from props when dialog opens
  useEffect(() => {
    if (open) {
      setAudioDir(initialAudioDir ?? "");
      setOutputName(initialConfigName ?? "");
    }
  }, [open, initialConfigName, initialAudioDir]);

  const mutation = useMutation({
    mutationFn: () => {
      // Build the config path for dataset_json (convention: config name matches file)
      const configPath = initialConfigName
        ? initialConfigName
        : undefined;

      return startPreprocess({
        audio_dir: audioDir,
        output_name: outputName,
        variant,
        max_duration: maxDuration,
        dataset_json: configPath ?? null,
      });
    },
    onSuccess: () => {
      setStatus("preprocessing");
      queryClient.invalidateQueries({ queryKey: ["dataset-configs"] });
      onOpenChange(false);
      toast.success("Preprocessing started");
    },
    onError: (err) => toast.error(`Preprocessing failed: ${err.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioDir.trim() || !outputName.trim()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initialConfigName
              ? `Preprocess: ${initialConfigName}`
              : "Preprocess Audio"}
          </DialogTitle>
          <DialogDescription>
            Convert audio files into training tensors.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Audio Directory</Label>
            <Input
              placeholder="/path/to/audio/files"
              value={audioDir}
              onChange={(e) => setAudioDir(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Output Name</Label>
            <Input
              placeholder="my-dataset"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <TooltipLabel tooltip="Must match the model variant you will train against. Preprocessing encodes audio using this variant's encoder.">
              Model Variant
            </TooltipLabel>
            <Select value={variant} onValueChange={setVariant}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="turbo">Turbo</SelectItem>
                <SelectItem value="base">Base</SelectItem>
                <SelectItem value="sft">SFT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <TooltipLabel tooltip="Audio clips longer than this will be truncated. Longer clips use more VRAM during preprocessing.">
              Max Duration: {maxDuration}s
            </TooltipLabel>
            <Slider
              min={30}
              max={600}
              step={10}
              value={[maxDuration]}
              onValueChange={(v) => setMaxDuration(v[0])}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Start Preprocessing
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
