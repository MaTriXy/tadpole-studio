"use client";

import { Music } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { PlaylistSongEntry, SongResponse } from "@/types/api";
import { SortableSongItem } from "./sortable-song-item";

interface PlaylistSongListProps {
  entries: PlaylistSongEntry[];
  onReorder: (songIds: string[]) => void;
  onPlay: (song: SongResponse) => void;
  onRemove: (songId: string) => void;
}

export function PlaylistSongList({
  entries,
  onReorder,
  onPlay,
  onRemove,
}: PlaylistSongListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const songIds = entries.map((e) => e.song_id);
    const oldIndex = songIds.indexOf(String(active.id));
    const newIndex = songIds.indexOf(String(over.id));
    const reordered = arrayMove(songIds, oldIndex, newIndex);
    onReorder(reordered);
  };

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card">
        <Music className="h-10 w-10 text-muted-foreground/30" />
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No songs in this playlist
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Add songs to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={entries.map((e) => e.song_id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {entries.map((entry) => (
            <SortableSongItem
              key={entry.song_id}
              entry={entry}
              onPlay={onPlay}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
