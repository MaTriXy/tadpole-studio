import { create } from "zustand";
import type { BackendType } from "@/types/api";

interface EngineSwitchState {
  switchingTo: BackendType | null;
  startSwitch: (target: BackendType) => void;
  clearSwitch: () => void;
}

export const useEngineSwitchStore = create<EngineSwitchState>()((set) => ({
  switchingTo: null,
  startSwitch: (target) => set({ switchingTo: target }),
  clearSwitch: () => set({ switchingTo: null }),
}));
