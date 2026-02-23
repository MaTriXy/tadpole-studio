"use client";

import { GraduationCap } from "lucide-react";
import { useTrainingStore } from "@/stores/training-store";
import { DatasetSection } from "./dataset-section";
import { TrainingConfigForm } from "./training-config-form";
import { TrainingProgress } from "./training-progress";
import { TrainingControls } from "./training-controls";

export function TrainingClient() {
  const isTraining = useTrainingStore((s) => s.isTraining);
  const status = useTrainingStore((s) => s.status);
  const showProgress = isTraining || status !== "idle";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Training</h1>
        </div>
        <TrainingControls />
      </div>

      {showProgress && <TrainingProgress />}

      <div className="grid gap-6 lg:grid-cols-2">
        <DatasetSection />
        <TrainingConfigForm />
      </div>
    </div>
  );
}
