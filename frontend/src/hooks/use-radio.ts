"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRadioStore } from "@/stores/radio-store";
import { usePlayerStore } from "@/stores/player-store";
import { generateNextTrack } from "@/lib/api/radio-client";
import { getSongAudioUrl } from "@/lib/api/client";
import { radioEngine } from "@/lib/audio/radio-engine";
import {
  acquireGenLock,
  releaseGenLock,
  forceReleaseGenLock,
  createRadioAbortController,
  abortRadioRequests,
  decodeAndCacheAudio,
  prefetchAudio,
} from "@/lib/audio/radio-helpers";
import { useGpuStore } from "@/stores/gpu-store";
import type { SongResponse } from "@/types/api";

// Monotonically increasing session counter. Each startStation call gets a new
// session. Async continuations bail out when the session has changed (i.e. the
// station was stopped or restarted).
let _sessionCounter = 0;
let _activeSession = 0;

export function useRadio() {
  const queryClient = useQueryClient();
  const activeStationId = useRadioStore((s) => s.activeStationId);
  const isGenerating = useRadioStore((s) => s.isGenerating);
  const setIsGenerating = useRadioStore((s) => s.setIsGenerating);
  const incrementSongsGenerated = useRadioStore((s) => s.incrementSongsGenerated);
  const stopStationBase = useRadioStore((s) => s.stopStation);

  const play = usePlayerStore((s) => s.play);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const setDuration = usePlayerStore((s) => s.setDuration);

  const startStation = useCallback(
    async (stationId: string) => {
      // Abort any in-flight requests from a previous session
      abortRadioRequests();
      forceReleaseGenLock();
      radioEngine.stop();
      radioEngine.clearBuffers();

      // Must be called synchronously within user gesture to unlock AudioContext
      radioEngine.warmup();

      // Start a new session
      _sessionCounter += 1;
      const session = _sessionCounter;
      _activeSession = session;

      const abortCtrl = createRadioAbortController();
      const signal = abortCtrl.signal;

      useRadioStore.getState().startStation(stationId);
      useGpuStore.getState().setHolder("radio");
      acquireGenLock();

      setIsGenerating(true);
      try {
        const result1 = await generateNextTrack(stationId, signal);
        if (session !== _activeSession) return; // cancelled

        if (result1.success && result1.song) {
          const song1 = result1.song as SongResponse;
          const url1 = getSongAudioUrl(song1.id);

          await decodeAndCacheAudio(song1.id);
          if (session !== _activeSession) return; // cancelled

          // Cache buffer BEFORE updating player store — the mini-player
          // effect checks radioEngine.hasBuffer() to distinguish radio
          // songs from library songs. If play() fires first, the effect
          // sees no buffer and kills the station.
          await radioEngine.play(song1.id);
          if (session !== _activeSession) return; // cancelled

          play(song1, url1);
          setQueue([song1], { [song1.id]: url1 });
          setDuration(radioEngine.duration);
          incrementSongsGenerated();

          // Pre-generate and decode song 2 while song 1 plays
          const result2 = await generateNextTrack(stationId, signal);
          if (session !== _activeSession) return; // cancelled

          if (result2.success && result2.song) {
            const song2 = result2.song as SongResponse;
            const url2 = getSongAudioUrl(song2.id);
            addToQueue(song2);
            const urls = usePlayerStore.getState().queueAudioUrls;
            usePlayerStore.setState({
              queueAudioUrls: { ...urls, [song2.id]: url2 },
            });
            prefetchAudio(song2.id);
            incrementSongsGenerated();
          }
        }
      } catch (err) {
        // Abort errors are expected when session is cancelled
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        // Only clean up if this is still the active session
        if (session === _activeSession) {
          queryClient.invalidateQueries({ queryKey: ["stations"] });
          queryClient.invalidateQueries({ queryKey: ["station-detail", stationId] });
          releaseGenLock();
          setIsGenerating(false);
          useGpuStore.getState().clear();
        }
      }
    },
    [play, setQueue, addToQueue, setIsGenerating, setDuration, incrementSongsGenerated, queryClient],
  );

  const stopStation = useCallback(() => {
    // Invalidate the current session so any in-flight async work bails out
    _sessionCounter += 1;
    _activeSession = _sessionCounter;

    // Abort all in-flight fetch requests
    abortRadioRequests();

    // Force-release the gen lock so useRadioPlayback doesn't get stuck
    forceReleaseGenLock();

    radioEngine.stop();
    radioEngine.clearBuffers();
    stopStationBase();
    useGpuStore.getState().clear();
  }, [stopStationBase]);

  return {
    activeStationId,
    isGenerating,
    startStation,
    stopStation,
    songsGenerated: useRadioStore.getState().songsGenerated,
  };
}
