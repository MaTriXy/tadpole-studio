import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SongResponse } from "@/types/api";

interface PlayerState {
  currentSong: SongResponse | null;
  audioUrl: string | null;
  queue: SongResponse[];
  queueAudioUrls: Record<string, string>;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  currentTime: number;
  duration: number;

  play: (song: SongResponse, audioUrl?: string) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setQueue: (songs: SongResponse[], audioUrls?: Record<string, string>) => void;
  addToQueue: (song: SongResponse) => void;
  playNext: () => void;
  playPrevious: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  showFullPlayer: boolean;
  toggleFullPlayer: () => void;
  showMiniQueue: boolean;
  toggleMiniQueue: () => void;
}

export const usePlayerStore = create<PlayerState>()(persist((set, get) => ({
  currentSong: null,
  audioUrl: null,
  queue: [],
  queueAudioUrls: {},
  isPlaying: false,
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: "off",
  currentTime: 0,
  duration: 0,

  play: (song, audioUrl) => set({ currentSong: song, audioUrl: audioUrl ?? null, isPlaying: true, currentTime: 0 }),
  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setVolume: (volume) => set({ volume, muted: volume === 0 }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => {
      const modes: Array<"off" | "all" | "one"> = ["off", "all", "one"];
      const idx = modes.indexOf(s.repeat);
      return { repeat: modes[(idx + 1) % modes.length] };
    }),
  setQueue: (songs, audioUrls) => set({ queue: songs, queueAudioUrls: audioUrls ?? {} }),
  addToQueue: (song) => set((s) => ({ queue: [...s.queue, song] })),
  playNext: () => {
    const { queue, currentSong, shuffle, repeat } = get();
    if (queue.length === 0) return;
    const currentIdx = currentSong
      ? queue.findIndex((s) => s.id === currentSong.id)
      : -1;
    let nextIdx: number;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = currentIdx + 1;
      if (nextIdx >= queue.length) {
        if (repeat === "all") nextIdx = 0;
        else {
          set({ isPlaying: false });
          return;
        }
      }
    }
    set({ currentSong: queue[nextIdx], audioUrl: get().queueAudioUrls[queue[nextIdx].id] ?? null, isPlaying: true });
  },
  playPrevious: () => {
    const { queue, currentSong, queueAudioUrls } = get();
    if (queue.length === 0) return;
    const currentIdx = currentSong
      ? queue.findIndex((s) => s.id === currentSong.id)
      : 0;
    const prevIdx = Math.max(0, currentIdx - 1);
    set({ currentSong: queue[prevIdx], audioUrl: queueAudioUrls[queue[prevIdx].id] ?? null, isPlaying: true });
  },
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  showFullPlayer: false,
  toggleFullPlayer: () => set((s) => ({ showFullPlayer: !s.showFullPlayer, showMiniQueue: false })),
  showMiniQueue: false,
  toggleMiniQueue: () => set((s) => ({ showMiniQueue: !s.showMiniQueue })),
}), {
  name: "tadpole-studio-player",
  partialize: (state) => ({
    queue: state.queue,
    queueAudioUrls: state.queueAudioUrls,
    currentSong: state.currentSong,
    volume: state.volume,
    muted: state.muted,
    shuffle: state.shuffle,
    repeat: state.repeat,
  }),
}));
