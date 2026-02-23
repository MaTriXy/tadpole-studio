"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayerStore } from "@/stores/player-store";
import { updateSong } from "@/lib/api/client";

const SEEK_DELTA = 5;
const VOLUME_DELTA = 0.05;

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

export function useKeyboardShortcuts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Never intercept when typing in form fields
      if (isInputFocused()) return;

      // Never intercept with Ctrl/Cmd (except Ctrl+Enter which is handled by GenerateButton)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const {
        currentSong,
        isPlaying,
        volume,
        muted,
        togglePlay,
        playNext,
        playPrevious,
        setVolume,
        toggleMute,
        setCurrentTime,
        duration,
        currentTime,
      } = usePlayerStore.getState();

      switch (e.key) {
        case " ": {
          e.preventDefault();
          if (currentSong) togglePlay();
          break;
        }

        case "ArrowLeft": {
          e.preventDefault();
          if (!currentSong || duration <= 0) break;
          const newTime = Math.max(0, currentTime - SEEK_DELTA);
          setCurrentTime(newTime);
          const audio = document.querySelector("audio");
          if (audio) audio.currentTime = newTime;
          break;
        }

        case "ArrowRight": {
          e.preventDefault();
          if (!currentSong || duration <= 0) break;
          const newTime = Math.min(duration, currentTime + SEEK_DELTA);
          setCurrentTime(newTime);
          const audio = document.querySelector("audio");
          if (audio) audio.currentTime = newTime;
          break;
        }

        case "ArrowUp": {
          e.preventDefault();
          const newVol = Math.min(1, (muted ? 0 : volume) + VOLUME_DELTA);
          setVolume(newVol);
          break;
        }

        case "ArrowDown": {
          e.preventDefault();
          const newVol = Math.max(0, (muted ? 0 : volume) - VOLUME_DELTA);
          setVolume(newVol);
          break;
        }

        case "m":
        case "M": {
          e.preventDefault();
          if (currentSong) toggleMute();
          break;
        }

        case "n":
        case "N": {
          e.preventDefault();
          if (currentSong) playNext();
          break;
        }

        case "p":
        case "P": {
          e.preventDefault();
          if (currentSong) playPrevious();
          break;
        }

        case "f":
        case "F": {
          e.preventDefault();
          if (!currentSong || currentSong.id.startsWith("result-")) break;
          updateSong(currentSong.id, {
            is_favorite: !currentSong.is_favorite,
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["songs"] });
          });
          break;
        }

        case "e":
        case "E": {
          const { currentSong, toggleFullPlayer } = usePlayerStore.getState();
          if (currentSong && !currentSong.id.startsWith("result-")) {
            e.preventDefault();
            toggleFullPlayer();
          }
          break;
        }

        case "1":
        case "2":
        case "3":
        case "4":
        case "5": {
          e.preventDefault();
          if (!currentSong || currentSong.id.startsWith("result-")) break;
          const rating = Number(e.key);
          const newRating = currentSong.rating === rating ? 0 : rating;
          updateSong(currentSong.id, { rating: newRating }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["songs"] });
          });
          break;
        }

        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [queryClient]);
}
