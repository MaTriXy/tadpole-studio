"use client";

import { useMutation } from "@tanstack/react-query";
import { Play, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startTraining, stopTraining } from "@/lib/api/client";
import { useTrainingStore } from "@/stores/training-store";

export function TrainingControls() {
  const isTraining = useTrainingStore((s) => s.isTraining);
  const status = useTrainingStore((s) => s.status);
  const config = useTrainingStore((s) => s.config);
  const setIsTraining = useTrainingStore((s) => s.setIsTraining);
  const setStatus = useTrainingStore((s) => s.setStatus);
  const clearLossHistory = useTrainingStore((s) => s.clearLossHistory);

  const startMutation = useMutation({
    mutationFn: () =>
      startTraining({
        dataset_dir: config.datasetDir,
        output_name: config.outputName,
        preset: config.selectedPreset,
        adapter_type: config.adapterType,
        rank: config.rank,
        alpha: config.alpha,
        dropout: config.dropout,
        learning_rate: config.learningRate,
        batch_size: config.batchSize,
        gradient_accumulation: config.gradientAccumulation,
        epochs: config.epochs,
        warmup_steps: config.warmupSteps,
        optimizer_type: config.optimizerType,
        scheduler_type: config.schedulerType,
        gradient_checkpointing: config.gradientCheckpointing,
        save_every: config.saveEvery,
        variant: config.variant,
      }),
    onSuccess: (data) => {
      toast.success(data.status);
      setIsTraining(true);
      setStatus("loading_model");
      clearLossHistory();
    },
    onError: (err) => toast.error(`Failed to start: ${err.message}`),
  });

  const stopMutation = useMutation({
    mutationFn: stopTraining,
    onSuccess: (data) => {
      toast.success(data.status);
      setStatus("stopping");
    },
    onError: (err) => toast.error(`Failed to stop: ${err.message}`),
  });

  const canStart =
    !isTraining &&
    config.datasetDir.length > 0 &&
    config.outputName.length > 0;

  return (
    <div className="flex gap-2">
      {!isTraining ? (
        <Button
          onClick={() => startMutation.mutate()}
          disabled={!canStart || startMutation.isPending}
        >
          {startMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Start Training
        </Button>
      ) : (
        <Button
          variant="destructive"
          onClick={() => stopMutation.mutate()}
          disabled={status === "stopping" || stopMutation.isPending}
        >
          {stopMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Square className="mr-2 h-4 w-4" />
          )}
          Stop Training
        </Button>
      )}
    </div>
  );
}
