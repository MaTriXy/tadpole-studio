import { create } from "zustand";
import { toast } from "sonner";
import type { TrainingUpdateMessage } from "@/types/api";

export interface TrainingConfig {
  datasetDir: string;
  outputName: string;
  selectedPreset: string | null;
  adapterType: string;
  rank: number;
  alpha: number;
  dropout: number;
  learningRate: number;
  batchSize: number;
  gradientAccumulation: number;
  epochs: number;
  warmupSteps: number;
  optimizerType: string;
  schedulerType: string;
  gradientCheckpointing: boolean;
  saveEvery: number;
  variant: string;
}

export interface LossPoint {
  step: number;
  loss: number;
}

interface TrainingState {
  isTraining: boolean;
  status:
    | "idle"
    | "preprocessing"
    | "loading_model"
    | "training"
    | "stopping";
  currentStep: number;
  currentEpoch: number;
  maxEpochs: number;
  latestLoss: number;
  outputName: string;
  latestMessage: string;
  learningRate: number;
  samplesPerSec: number;
  stepsPerEpoch: number;

  lossHistory: LossPoint[];

  config: TrainingConfig;

  updateFromWsMessage: (msg: TrainingUpdateMessage) => void;
  setConfig: (partial: Partial<TrainingConfig>) => void;
  applyPreset: (config: Record<string, unknown>) => void;
  reset: () => void;
  clearLossHistory: () => void;
  setStatus: (status: TrainingState["status"]) => void;
  setIsTraining: (v: boolean) => void;
}

const DEFAULT_CONFIG: TrainingConfig = {
  datasetDir: "",
  outputName: "",
  selectedPreset: null,
  adapterType: "lora",
  rank: 64,
  alpha: 128,
  dropout: 0.1,
  learningRate: 1e-4,
  batchSize: 1,
  gradientAccumulation: 4,
  epochs: 100,
  warmupSteps: 100,
  optimizerType: "adamw",
  schedulerType: "cosine",
  gradientCheckpointing: true,
  saveEvery: 10,
  variant: "turbo",
};

export const useTrainingStore = create<TrainingState>()((set) => ({
  isTraining: false,
  status: "idle",
  currentStep: 0,
  currentEpoch: 0,
  maxEpochs: 0,
  latestLoss: 0,
  outputName: "",
  latestMessage: "",
  learningRate: 0,
  samplesPerSec: 0,
  stepsPerEpoch: 0,

  lossHistory: [],

  config: { ...DEFAULT_CONFIG },

  updateFromWsMessage: (msg) =>
    set((s) => {
      const updates: Partial<TrainingState> = {
        latestMessage: msg.msg,
      };

      if (msg.type === "step") {
        updates.currentStep = msg.step;
        updates.latestLoss = msg.loss;
        updates.learningRate = msg.lr;
        updates.samplesPerSec = msg.samples_per_sec;
        updates.stepsPerEpoch = msg.steps_per_epoch;
        updates.lossHistory = [
          ...s.lossHistory,
          { step: msg.step, loss: msg.loss },
        ];
        if (s.status === "loading_model") {
          updates.status = "training";
        }
      }

      if (msg.type === "epoch") {
        updates.currentEpoch = msg.epoch;
        updates.maxEpochs = msg.max_epochs;
        if (s.status === "loading_model") {
          updates.status = "training";
        }
      }

      if (msg.type === "complete") {
        updates.isTraining = false;
        updates.status = "idle";
        toast.success(msg.msg || "Training complete");
      }

      if (msg.type === "fail") {
        updates.isTraining = false;
        updates.status = "idle";
        toast.error(msg.msg || "Training failed");
      }

      if (msg.type === "info") {
        if (msg.max_epochs > 0) {
          updates.maxEpochs = msg.max_epochs;
          updates.currentStep = msg.step;
        }
        // Keep preprocessing status visible while info messages arrive
        if (s.status === "preprocessing") {
          updates.status = "preprocessing";
        }
      }

      return updates;
    }),

  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),

  applyPreset: (presetConfig) =>
    set((s) => ({
      config: {
        ...s.config,
        selectedPreset:
          (presetConfig.name as string) ?? s.config.selectedPreset,
        rank: (presetConfig.rank as number) ?? s.config.rank,
        alpha: (presetConfig.alpha as number) ?? s.config.alpha,
        dropout: (presetConfig.dropout as number) ?? s.config.dropout,
        learningRate:
          (presetConfig.learning_rate as number) ?? s.config.learningRate,
        batchSize:
          (presetConfig.batch_size as number) ?? s.config.batchSize,
        gradientAccumulation:
          (presetConfig.gradient_accumulation as number) ??
          s.config.gradientAccumulation,
        epochs: (presetConfig.epochs as number) ?? s.config.epochs,
        warmupSteps:
          (presetConfig.warmup_steps as number) ?? s.config.warmupSteps,
        optimizerType:
          (presetConfig.optimizer_type as string) ?? s.config.optimizerType,
        schedulerType:
          (presetConfig.scheduler_type as string) ?? s.config.schedulerType,
        gradientCheckpointing:
          (presetConfig.gradient_checkpointing as boolean) ??
          s.config.gradientCheckpointing,
        saveEvery:
          (presetConfig.save_every as number) ?? s.config.saveEvery,
      },
    })),

  reset: () =>
    set({
      isTraining: false,
      status: "idle",
      currentStep: 0,
      currentEpoch: 0,
      maxEpochs: 0,
      latestLoss: 0,
      outputName: "",
      latestMessage: "",
      learningRate: 0,
      samplesPerSec: 0,
      stepsPerEpoch: 0,
      lossHistory: [],
      config: { ...DEFAULT_CONFIG },
    }),

  clearLossHistory: () => set({ lossHistory: [] }),

  setStatus: (status) => set({ status }),

  setIsTraining: (v) => set({ isTraining: v }),
}));
