"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  Maximize2,
} from "lucide-react";
import { usePlayerStore } from "@/stores/player-store";
import { useRadioStore } from "@/stores/radio-store";
import { getSongAudioUrl } from "@/lib/api/client";
import { radioEngine } from "@/lib/audio/radio-engine";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MarqueeText } from "@/components/ui/marquee-text";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MiniPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastTimeUpdateRef = useRef(0);
  const prevSongIdRef = useRef<string | null>(null);

  const currentSong = usePlayerStore((s) => s.currentSong);
  const audioUrl = usePlayerStore((s) => s.audioUrl);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const repeat = usePlayerStore((s) => s.repeat);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrevious = usePlayerStore((s) => s.playPrevious);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const pause = usePlayerStore((s) => s.pause);
  const toggleFullPlayer = usePlayerStore((s) => s.toggleFullPlayer);
  const showMiniQueue = usePlayerStore((s) => s.showMiniQueue);
  const toggleMiniQueue = usePlayerStore((s) => s.toggleMiniQueue);
  const activeStationId = useRadioStore((s) => s.activeStationId);

  // Resolve the URL: use explicit audioUrl if provided, otherwise derive from song id
  const resolvedUrl = audioUrl ?? (currentSong ? getSongAudioUrl(currentSong.id) : null);

  // Load new source when song/url changes
  useEffect(() => {
    const songChanged = currentSong?.id !== prevSongIdRef.current;
    prevSongIdRef.current = currentSong?.id ?? null;

    if (activeStationId) {
      if (currentSong && radioEngine.hasBuffer(currentSong.id)) {
        // Radio mode: switch engine to new song on skip forward/back
        if (currentSong.id !== radioEngine.currentSongId) {
          radioEngine.play(currentSong.id);
          setDuration(radioEngine.duration);
          setCurrentTime(0);
        }
        return;
      }
      // Only stop radio if a NEW non-radio song was explicitly played.
      // Don't stop when activeStationId just changed (startup) or
      // when currentSong is null.
      if (songChanged && currentSong) {
        radioEngine.stop();
        useRadioStore.getState().stopStation();
        toast.info("Radio stopped", {
          description: "Playing a song from your library",
        });
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio || !resolvedUrl) return;

    if (audio.src !== resolvedUrl) {
      audio.src = resolvedUrl;
      audio.load();
    }
  }, [resolvedUrl, activeStationId, currentSong, setDuration, setCurrentTime]);

  // Play/pause sync
  useEffect(() => {
    if (activeStationId) {
      // Radio mode: delegate to engine
      if (isPlaying) {
        if (radioEngine.playing) return; // already playing
        radioEngine.resume();
      } else {
        radioEngine.pause();
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio || !resolvedUrl) return;

    if (isPlaying) {
      // If audio isn't ready yet (e.g. after app restart), let onCanPlay handle it
      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        audio.play().catch(() => pause());
      }
      // Otherwise, handleCanPlay will auto-start when the source loads
    } else {
      audio.pause();
    }
  }, [isPlaying, resolvedUrl, pause, activeStationId]);

  // Volume sync
  useEffect(() => {
    if (activeStationId) {
      radioEngine.setVolume(muted ? 0 : volume);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted, activeStationId]);

  // Audio event handlers
  const handleTimeUpdate = useCallback(() => {
    const now = Date.now();
    if (now - lastTimeUpdateRef.current < 500) return;
    lastTimeUpdateRef.current = now;
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
  }, [setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  }, [setDuration]);

  // Auto-play when the source becomes ready (handles restart + click play before loaded)
  const handleCanPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (usePlayerStore.getState().isPlaying && audio.paused) {
      audio.play().catch(() => pause());
    }
  }, [pause]);

  const handleEnded = useCallback(() => {
    if (repeat === "one") {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play();
      }
    } else {
      playNext();
    }
  }, [repeat, playNext]);

  const [seekValue, setSeekValue] = useState<number | null>(null);

  const handleSeeking = useCallback(([value]: number[]) => {
    setSeekValue(value);
  }, []);

  const handleSeekCommit = useCallback(
    ([value]: number[]) => {
      setSeekValue(null);
      if (duration <= 0) return;
      const time = (value / 100) * duration;
      if (activeStationId) {
        radioEngine.seek(time);
        setCurrentTime(time);
        return;
      }
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = time;
        setCurrentTime(time);
      }
    },
    [duration, setCurrentTime, activeStationId],
  );

  if (!currentSong) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-[72px] items-center border-t border-border bg-card px-4">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        preload="auto"
      />

      {/* Song info */}
      <div className="flex min-w-0 items-center gap-3 sm:w-[280px]">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 sm:flex">
          <span className="text-lg text-primary">&#9835;</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <MarqueeText text={currentSong.title} className="text-sm font-medium" />
            {activeStationId && (
              <span className="ml-0.5 shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-500">
                Radio
              </span>
            )}
          </div>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {currentSong.caption || "No description"}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 sm:inline-flex"
                onClick={playPrevious}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isPlaying ? "Pause" : "Play"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 sm:inline-flex"
                onClick={playNext}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next</TooltipContent>
          </Tooltip>
        </div>
        <div className="hidden w-full max-w-md items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="w-10 text-right">{formatTime(currentTime)}</span>
          <Slider
            value={[seekValue ?? (duration > 0 ? (currentTime / duration) * 100 : 0)]}
            max={100}
            step={0.1}
            className="flex-1"
            onValueChange={handleSeeking}
            onValueCommit={handleSeekCommit}
          />
          <span className="w-10">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="hidden items-center justify-end gap-2 sm:flex sm:w-[180px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleMute}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{muted || volume === 0 ? "Unmute" : "Mute"}</TooltipContent>
        </Tooltip>
        <Slider
          value={[muted ? 0 : volume * 100]}
          max={100}
          step={1}
          className="w-24"
          onValueChange={([v]) => setVolume(v / 100)}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", showMiniQueue && "text-primary")}
              onClick={toggleMiniQueue}
              data-mini-queue-toggle
            >
              <ListMusic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Queue</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullPlayer}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Expand player</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
