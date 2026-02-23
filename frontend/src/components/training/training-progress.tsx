"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTrainingStore } from "@/stores/training-store";
import { LossChart } from "./loss-chart";

const STATUS_BADGES: Record<string, { className: string; label: string }> = {
  loading_model: {
    className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border-yellow-500/30",
    label: "Loading Model",
  },
  training: {
    className: "bg-green-500/10 text-green-700 dark:text-green-500 border-green-500/30",
    label: "Training",
  },
  stopping: {
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-500 border-orange-500/30",
    label: "Stopping",
  },
  preprocessing: {
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-500 border-blue-500/30",
    label: "Preprocessing",
  },
};

export function TrainingProgress() {
  const status = useTrainingStore((s) => s.status);
  const currentStep = useTrainingStore((s) => s.currentStep);
  const currentEpoch = useTrainingStore((s) => s.currentEpoch);
  const maxEpochs = useTrainingStore((s) => s.maxEpochs);
  const latestLoss = useTrainingStore((s) => s.latestLoss);
  const learningRate = useTrainingStore((s) => s.learningRate);
  const samplesPerSec = useTrainingStore((s) => s.samplesPerSec);
  const latestMessage = useTrainingStore((s) => s.latestMessage);

  const badge = STATUS_BADGES[status];
  const isPreprocessing = status === "preprocessing";
  const progressPct = isPreprocessing
    ? maxEpochs > 0 ? (currentStep / maxEpochs) * 100 : 0
    : maxEpochs > 0 ? (currentEpoch / maxEpochs) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {isPreprocessing ? "Preprocessing Progress" : "Training Progress"}
          </CardTitle>
          {badge && (
            <Badge variant="outline" className={badge.className}>
              {status === "loading_model" && (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              {badge.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {isPreprocessing ? "Files" : "Epoch"}
            </span>
            <span>
              {isPreprocessing ? currentStep : currentEpoch} / {maxEpochs}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Stats grid — only show training-specific stats when training */}
        {!isPreprocessing && (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Step</p>
              <p className="font-medium">{currentStep}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Loss</p>
              <p className="font-medium">
                {latestLoss > 0 ? latestLoss.toFixed(4) : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">LR</p>
              <p className="font-medium">
                {learningRate > 0 ? learningRate.toExponential(1) : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Speed</p>
              <p className="font-medium">
                {samplesPerSec > 0 ? `${samplesPerSec.toFixed(1)} s/s` : "—"}
              </p>
            </div>
          </div>
        )}

        {/* Loss chart — only during training */}
        {!isPreprocessing && <LossChart />}

        {/* Latest message */}
        {latestMessage && (
          <p className="truncate text-xs text-muted-foreground">
            {latestMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
