"use client";

import { GripVertical, Play, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import type { PlaylistSongEntry, SongResponse } from "@/types/api";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";

interface SortableSongItemProps {
  entry: PlaylistSongEntry;
  onPlay: (song: SongResponse) => void;
  onRemove: (songId: string) => void;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SortableSongItem({ entry, onPlay, onRemove }: SortableSongItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.song_id });

  const currentSongId = usePlayerStore((s) => s.currentSong?.id);
  const isActive = currentSongId === entry.song.id;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50",
        isDragging && "opacity-50",
        isActive && "border-primary/50 bg-primary/5",
      )}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 transition-colors hover:bg-primary/20",
          isActive && "bg-primary/20",
        )}
        onClick={() => onPlay(entry.song)}
      >
        <Play className={cn("h-3.5 w-3.5 text-primary", isActive && "fill-primary")} />
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-sm font-medium">{entry.song.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {entry.song.caption || "No description"}
        </p>
      </div>

      <span className="hidden text-xs text-muted-foreground sm:inline">
        {formatDuration(entry.song.duration_seconds)}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100"
        onClick={() => onRemove(entry.song_id)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
