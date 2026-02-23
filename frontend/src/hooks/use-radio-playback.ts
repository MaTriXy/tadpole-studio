"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRadioStore } from "@/stores/radio-store";
import { usePlayerStore } from "@/stores/player-store";
import { generateNextTrack, fetchStation } from "@/lib/api/radio-client";
import { getSongAudioUrl, fetchPlaylists, createPlaylist, addSongsToPlaylist } from "@/lib/api/client";
import { radioEngine } from "@/lib/audio/radio-engine";
import { ambientNoise } from "@/lib/audio/ambient-noise";
import { useAmbientStore } from "@/stores/ambient-store";
import {
  BUFFER_THRESHOLD,
  RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  acquireGenLock,
  releaseGenLock,
  isGenLocked,
  getRadioSignal,
  decodeAndCacheAudio,
  prefetchAudio,
} from "@/lib/audio/radio-helpers";
import { useGpuStore } from "@/stores/gpu-store";
import { useSettingsStore } from "@/stores/settings-store";
import type { SongResponse } from "@/types/api";

async function autoSaveRadioTrack(stationId: string, song: SongResponse): Promise<void> {
  try {
    const station = await fetchStation(stationId);
    const stationName = station.name;

    const playlists = await fetchPlaylists();
    let playlist = playlists.find((p) => p.name === stationName);

    if (!playlist) {
      playlist = await createPlaylist({ name: stationName });
    }

    await addSongsToPlaylist(playlist.id, [song.id]);
  } catch {
    // Silently fail -- auto-save must never break generation
  }
}

/**
 * Persistent radio playback hook — runs in AppShell so callbacks survive
 * tab navigation. No-op when no station is active.
 */
export function useRadioPlayback(): void {
  const queryClient = useQueryClient();
  const activeStationId = useRadioStore((s) => s.activeStationId);
  const isGenerating = useRadioStore((s) => s.isGenerating);
  const setIsGenerating = useRadioStore((s) => s.setIsGenerating);
  const incrementSongsGenerated = useRadioStore((s) => s.incrementSongsGenerated);

  const queue = usePlayerStore((s) => s.queue);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const playNext = usePlayerStore((s) => s.playNext);

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const retryDelayRef = useRef(RETRY_DELAY_MS);

  const generateTrack = useCallback(async () => {
    const stationId = useRadioStore.getState().activeStationId;
    if (!stationId || !acquireGenLock()) return;

    const signal = getRadioSignal();

    useGpuStore.getState().setHolder("radio");
    setIsGenerating(true);
    try {
      const result = await generateNextTrack(stationId, signal);

      // Bail out if station was stopped during the request
      if (!useRadioStore.getState().activeStationId) {
        releaseGenLock();
        setIsGenerating(false);
        useGpuStore.getState().clear();
        return;
      }

      if (result.success && result.song) {
        const song = result.song as SongResponse;
        const audioUrl = getSongAudioUrl(song.id);

        const { currentSong: current, play, setQueue, addToQueue } = usePlayerStore.getState();
        if (!current) {
          await decodeAndCacheAudio(song.id);
          if (!useRadioStore.getState().activeStationId) {
            releaseGenLock();
            setIsGenerating(false);
            useGpuStore.getState().clear();
            return;
          }
          play(song, audioUrl);
          setQueue([song], { [song.id]: audioUrl });
          await radioEngine.play(song.id);
          setDuration(radioEngine.duration);
        } else {
          addToQueue(song);
          const currentUrls = usePlayerStore.getState().queueAudioUrls;
          usePlayerStore.setState({
            queueAudioUrls: { ...currentUrls, [song.id]: audioUrl },
          });
          prefetchAudio(song.id);
        }
        incrementSongsGenerated();

        try {
          const { radioAutoSave } = useSettingsStore.getState();
          if (radioAutoSave && stationId) {
            autoSaveRadioTrack(stationId, song);
          }
        } catch {
          // Auto-save must never break generation
        }

        queryClient.invalidateQueries({ queryKey: ["stations"] });
        queryClient.invalidateQueries({ queryKey: ["station-detail", stationId] });
        retryDelayRef.current = RETRY_DELAY_MS;
      }
    } catch (err) {
      // Abort errors are expected on stop — don't retry
      if (err instanceof DOMException && err.name === "AbortError") {
        releaseGenLock();
        setIsGenerating(false);
        useGpuStore.getState().clear();
        return;
      }

      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
      retryTimeoutRef.current = setTimeout(() => {
        releaseGenLock();
        setIsGenerating(false);
        useGpuStore.getState().clear();
      }, delay);
      return;
    }
    releaseGenLock();
    setIsGenerating(false);
    useGpuStore.getState().clear();
  }, [setIsGenerating, incrementSongsGenerated, setDuration, queryClient]);

  // Wire engine ontimeupdate
  useEffect(() => {
    if (!activeStationId) {
      radioEngine.ontimeupdate = null;
      return;
    }
    radioEngine.ontimeupdate = (time: number) => {
      usePlayerStore.getState().setCurrentTime(time);
    };
    return () => {
      radioEngine.ontimeupdate = null;
    };
  }, [activeStationId]);

  // Wire engine onended: handle repeat-one and playNext
  useEffect(() => {
    if (!activeStationId) {
      radioEngine.onended = null;
      return;
    }
    radioEngine.onended = () => {
      const { repeat, currentSong: cs, setCurrentTime: sct, setDuration: sd, playNext: pn } =
        usePlayerStore.getState();
      if (repeat === "one" && cs) {
        radioEngine.play(cs.id);
        sct(0);
      } else {
        pn();
        const { currentSong: next } = usePlayerStore.getState();
        if (next && radioEngine.hasBuffer(next.id)) {
          radioEngine.play(next.id);
          sd(radioEngine.duration);
          sct(0);
        }
      }
    };
    return () => {
      radioEngine.onended = null;
    };
  }, [activeStationId]);

  // Auto-generate when buffer is low
  useEffect(() => {
    if (!activeStationId || isGenLocked() || isGenerating) return;

    const currentIdx = currentSong
      ? queue.findIndex((s) => s.id === currentSong.id)
      : -1;
    const remaining = queue.length - currentIdx - 1;

    if (remaining < BUFFER_THRESHOLD) {
      generateTrack();
    }
  }, [activeStationId, queue.length, currentSong?.id, isGenerating, generateTrack]);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Ambient noise: start/stop with station
  useEffect(() => {
    if (activeStationId) {
      const ctx = radioEngine.audioContext;
      if (ctx) {
        ambientNoise.attachContext(ctx);
        const { enabled, effect, volume } = useAmbientStore.getState();
        ambientNoise.setConfig({ effect, volume });
        if (enabled) ambientNoise.start();
      }
    } else {
      ambientNoise.stop();
    }
    return () => {
      ambientNoise.stop();
    };
  }, [activeStationId]);

  // Ambient noise: react to store changes in real-time
  useEffect(() => {
    const unsub = useAmbientStore.subscribe((state) => {
      if (!activeStationId) return;
      ambientNoise.setConfig({ effect: state.effect, volume: state.volume });
      if (state.enabled && !ambientNoise.running) {
        const ctx = radioEngine.audioContext;
        if (ctx) {
          ambientNoise.attachContext(ctx);
          ambientNoise.start();
        }
      } else if (!state.enabled && ambientNoise.running) {
        ambientNoise.stop();
      }
    });
    return unsub;
  }, [activeStationId]);
}
