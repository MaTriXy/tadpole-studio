"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/stores/player-store";

export function useMediaSession() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // Wire up media key action handlers
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const handlers: [MediaSessionAction, () => void][] = [
      ["play", () => usePlayerStore.getState().resume()],
      ["pause", () => usePlayerStore.getState().pause()],
      ["nexttrack", () => usePlayerStore.getState().playNext()],
      ["previoustrack", () => usePlayerStore.getState().playPrevious()],
    ];

    for (const [action, handler] of handlers) {
      navigator.mediaSession.setActionHandler(action, handler);
    }

    return () => {
      for (const [action] of handlers) {
        navigator.mediaSession.setActionHandler(action, null);
      }
    };
  }, []);

  // Update metadata when current song changes
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.caption || "Tadpole Studio",
        album: "Tadpole Studio",
      });
    } else {
      navigator.mediaSession.metadata = null;
    }
  }, [currentSong]);

  // Update playback state
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);
}
