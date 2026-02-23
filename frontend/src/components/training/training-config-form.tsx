"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TooltipLabel } from "@/components/ui/tooltip-label";
import { fetchPresets } from "@/lib/api/client";
import { useTrainingStore } from "@/stores/training-store";

export function TrainingConfigForm() {
  const config = useTrainingStore((s) => s.config);
  const setConfig = useTrainingStore((s) => s.setConfig);
  const applyPreset = useTrainingStore((s) => s.applyPreset);

  const { data: presets = [] } = useQuery({
    queryKey: ["presets"],
    queryFn: fetchPresets,
  });

  const handlePresetChange = (presetName: string) => {
    const preset = presets.find((p) => p.name === presetName);
    if (preset) {
      applyPreset(preset.config);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Training Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 overflow-hidden">
        {/* Preset selector */}
        <div className="space-y-2">
          <Label>Preset</Label>
          <Select
            value={config.selectedPreset ?? ""}
            onValueChange={handlePresetChange}
          >
            <SelectTrigger className="truncate">
              <SelectValue placeholder="Select a preset..." />
            </SelectTrigger>
            <SelectContent>
              {presets.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                  {p.description && (
                    <span className="ml-2 text-muted-foreground">
                      — {p.description}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Output name */}
        <div className="space-y-2">
          <TooltipLabel tooltip="Name for the output LoRA adapter files. Checkpoints will be saved under this name.">
            Output Name
          </TooltipLabel>
          <Input
            placeholder="my-lora"
            value={config.outputName}
            onChange={(e) => setConfig({ outputName: e.target.value })}
          />
        </div>

        <Separator />

        {/* Adapter section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Adapter
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <TooltipLabel tooltip="LoRA is stable and recommended. LoKR uses Kronecker product factorization — experimental but can be 10x faster.">
                Type
              </TooltipLabel>
              <Select
                value={config.adapterType}
                onValueChange={(v) => setConfig({ adapterType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lora">LoRA</SelectItem>
                  <SelectItem value="lokr">LoKR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <TooltipLabel tooltip="Model variant to train against. Must match the variant used during preprocessing.">
                Variant
              </TooltipLabel>
              <Select
                value={config.variant}
                onValueChange={(v) => setConfig({ variant: v })}
              >
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
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <TooltipLabel tooltip="Adapter capacity. 16 = quick iterations, 64 = default, 128 = max fidelity. Higher rank uses more VRAM.">
                Rank
              </TooltipLabel>
              <Input
                type="number"
                value={config.rank}
                onChange={(e) =>
                  setConfig({ rank: parseInt(e.target.value) || 64 })
                }
              />
            </div>
            <div className="space-y-2">
              <TooltipLabel tooltip="Scaling factor for the adapter. Typically set to 2x rank. Controls how strongly the adapter influences the model.">
                Alpha
              </TooltipLabel>
              <Input
                type="number"
                value={config.alpha}
                onChange={(e) =>
                  setConfig({ alpha: parseInt(e.target.value) || 128 })
                }
              />
            </div>
            <div className="space-y-2">
              <TooltipLabel tooltip="Regularization to prevent overfitting. 0.0 = no dropout, 0.1 = typical. Higher values reduce memorization.">
                Dropout
              </TooltipLabel>
              <Input
                type="number"
                step="0.01"
                value={config.dropout}
                onChange={(e) =>
                  setConfig({ dropout: parseFloat(e.target.value) || 0.1 })
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Optimizer section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Optimizer
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <TooltipLabel tooltip="AdamW = standard, stable. 8-bit = saves ~30% VRAM. Adafactor = minimal memory. Prodigy = auto-tunes LR (set LR to 1.0 and use Constant scheduler).">
                Optimizer
              </TooltipLabel>
              <Select
                value={config.optimizerType}
                onValueChange={(v) => setConfig({ optimizerType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adamw">AdamW</SelectItem>
                  <SelectItem value="adamw8bit">AdamW 8-bit</SelectItem>
                  <SelectItem value="adafactor">Adafactor</SelectItem>
                  <SelectItem value="prodigy">Prodigy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <TooltipLabel tooltip="LR decay schedule. Cosine = smooth decay (default). Linear = steady decrease. Constant = no decay. Use Constant with Prodigy optimizer.">
                Scheduler
              </TooltipLabel>
              <Select
                value={config.schedulerType}
                onValueChange={(v) => setConfig({ schedulerType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cosine">Cosine</SelectItem>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="constant">Constant</SelectItem>
                  <SelectItem value="constant_with_warmup">
                    Constant + Warmup
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <TooltipLabel tooltip="1e-4 is recommended for AdamW / Adafactor. Set to 1.0 for Prodigy (it auto-tunes).">
              Learning Rate: {config.learningRate.toExponential(1)}
            </TooltipLabel>
            <Slider
              min={-6}
              max={-2}
              step={0.1}
              value={[Math.log10(config.learningRate)]}
              onValueChange={(v) =>
                setConfig({ learningRate: Math.pow(10, v[0]) })
              }
            />
          </div>

          <div className="space-y-2">
            <TooltipLabel tooltip="Gradual LR increase at start to stabilize early training. Prevents large initial gradient updates.">
              Warmup Steps: {config.warmupSteps}
            </TooltipLabel>
            <Slider
              min={0}
              max={1000}
              step={10}
              value={[config.warmupSteps]}
              onValueChange={(v) => setConfig({ warmupSteps: v[0] })}
            />
          </div>
        </div>

        <Separator />

        {/* Training section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Training
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <TooltipLabel tooltip="Scale by dataset size: 1-10 songs = 200-500, 10-50 songs = 100-200, 50+ songs = 50-100. Monitor loss to decide when to stop.">
                Epochs
              </TooltipLabel>
              <Input
                type="number"
                value={config.epochs}
                onChange={(e) =>
                  setConfig({ epochs: parseInt(e.target.value) || 100 })
                }
              />
            </div>
            <div className="space-y-2">
              <TooltipLabel tooltip="Samples per training step. Default 1 uses minimal VRAM. Increase to 2-4 if you have enough VRAM.">
                Batch Size
              </TooltipLabel>
              <Input
                type="number"
                value={config.batchSize}
                onChange={(e) =>
                  setConfig({ batchSize: parseInt(e.target.value) || 1 })
                }
              />
            </div>
            <div className="space-y-2">
              <TooltipLabel tooltip="Simulates a larger batch size without extra VRAM. Effective batch = batch size x grad accum. Default 4.">
                Grad Accum
              </TooltipLabel>
              <Input
                type="number"
                value={config.gradientAccumulation}
                onChange={(e) =>
                  setConfig({
                    gradientAccumulation: parseInt(e.target.value) || 4,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <TooltipLabel tooltip="Checkpoint save interval. Use smaller intervals for shorter runs so you can pick the best checkpoint.">
              Save Every N Epochs: {config.saveEvery}
            </TooltipLabel>
            <Slider
              min={1}
              max={50}
              step={1}
              value={[config.saveEvery]}
              onValueChange={(v) => setConfig({ saveEvery: v[0] })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="gradient-checkpointing"
              checked={config.gradientCheckpointing}
              onCheckedChange={(checked) =>
                setConfig({ gradientCheckpointing: checked })
              }
            />
            <TooltipLabel
              htmlFor="gradient-checkpointing"
              tooltip="Recomputes activations during backward pass to save 40-60% VRAM. ~10-30% slower. Recommended on."
            >
              Gradient Checkpointing
            </TooltipLabel>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
