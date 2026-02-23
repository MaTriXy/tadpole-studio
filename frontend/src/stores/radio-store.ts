import { create } from "zustand";
import type { StationResponse } from "@/types/api";

interface RadioState {
  stations: StationResponse[];
  activeStationId: string | null;
  isGenerating: boolean;
  songsGenerated: number;

  setStations: (stations: StationResponse[]) => void;
  startStation: (id: string) => void;
  stopStation: () => void;
  setIsGenerating: (v: boolean) => void;
  incrementSongsGenerated: () => void;
}

export const useRadioStore = create<RadioState>()((set) => ({
  stations: [],
  activeStationId: null,
  isGenerating: false,
  songsGenerated: 0,

  setStations: (stations) => set({ stations }),
  startStation: (id) => set({ activeStationId: id, songsGenerated: 0 }),
  stopStation: () => set({ activeStationId: null, isGenerating: false, songsGenerated: 0 }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  incrementSongsGenerated: () => set((s) => ({ songsGenerated: s.songsGenerated + 1 })),
}));
