"use client";

import { ListMusic } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlaylistResponse } from "@/types/api";
import { PlaylistCard } from "./playlist-card";

interface PlaylistGridProps {
  playlists: PlaylistResponse[];
  isLoading: boolean;
  onPlaylistClick: (playlist: PlaylistResponse) => void;
  onEditPlaylist: (playlist: PlaylistResponse) => void;
  onDeletePlaylist: (playlist: PlaylistResponse) => void;
}

export function PlaylistGrid({
  playlists,
  isLoading,
  onPlaylistClick,
  onEditPlaylist,
  onDeletePlaylist,
}: PlaylistGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card">
        <ListMusic className="h-12 w-12 text-muted-foreground/30" />
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No playlists yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Create a playlist to organize your songs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {playlists.map((playlist) => (
        <PlaylistCard
          key={playlist.id}
          playlist={playlist}
          onClick={() => onPlaylistClick(playlist)}
          onEdit={() => onEditPlaylist(playlist)}
          onDelete={() => onDeletePlaylist(playlist)}
        />
      ))}
    </div>
  );
}
