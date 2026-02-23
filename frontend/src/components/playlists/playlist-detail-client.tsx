"use client";

import { useState, useCallback, useMemo } from "react";
import { ArrowLeft, Play, Plus, Trash2, Loader2, Download } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchPlaylist,
  addSongsToPlaylist,
  removeSongFromPlaylist,
  reorderPlaylistSongs,
  getSongAudioUrl,
  getPlaylistExportUrl,
} from "@/lib/api/client";
import { exportPlaylistZip } from "@/lib/export-utils";
import { usePlayerStore } from "@/stores/player-store";
import type { SongResponse, PlaylistDetailResponse } from "@/types/api";
import { PlaylistSongList } from "./playlist-song-list";
import { AddSongsDialog } from "./add-songs-dialog";
import { DeletePlaylistDialog } from "./delete-playlist-dialog";

export function PlaylistDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [addSongsOpen, setAddSongsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const play = usePlayerStore((s) => s.play);
  const setQueue = usePlayerStore((s) => s.setQueue);

  const { data: playlist, isLoading } = useQuery({
    queryKey: ["playlist", id],
    queryFn: () => fetchPlaylist(id),
    enabled: !!id,
  });

  const addMutation = useMutation({
    mutationFn: (songIds: string[]) => addSongsToPlaylist(id, songIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", id] });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Songs added to playlist");
      setAddSongsOpen(false);
    },
    onError: (err) => {
      toast.error(`Failed to add songs: ${err.message}`);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (songId: string) => removeSongFromPlaylist(id, songId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", id] });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Song removed from playlist");
    },
    onError: (err) => {
      toast.error(`Failed to remove song: ${err.message}`);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (songIds: string[]) => reorderPlaylistSongs(id, songIds),
    onMutate: async (songIds) => {
      await queryClient.cancelQueries({ queryKey: ["playlist", id] });
      const previous = queryClient.getQueryData<PlaylistDetailResponse>(["playlist", id]);
      if (previous) {
        const songMap = new Map(previous.songs.map((e) => [e.song_id, e]));
        const reorderedSongs = songIds
          .map((songId, index) => {
            const entry = songMap.get(songId);
            if (!entry) return null;
            return { ...entry, position: index };
          })
          .filter(Boolean);
        queryClient.setQueryData(["playlist", id], {
          ...previous,
          songs: reorderedSongs,
        });
      }
      return { previous };
    },
    onError: (err, _songIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["playlist", id], context.previous);
      }
      toast.error(`Failed to reorder: ${err.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", id] });
    },
  });

  const handlePlay = useCallback(
    (song: SongResponse) => {
      if (playlist?.songs) {
        const songs = playlist.songs.map((e) => e.song);
        setQueue(songs);
        play(song, getSongAudioUrl(song.id));
      }
    },
    [playlist, setQueue, play],
  );

  const handlePlayAll = useCallback(() => {
    if (playlist?.songs && playlist.songs.length > 0) {
      const songs = playlist.songs.map((e) => e.song);
      setQueue(songs);
      play(songs[0], getSongAudioUrl(songs[0].id));
    }
  }, [playlist, setQueue, play]);

  const existingSongIds = useMemo(
    () => playlist?.songs?.map((e) => e.song_id) ?? [],
    [playlist],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Playlist not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/playlists")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {playlist.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handlePlayAll}
          disabled={playlist.songs.length === 0}
          className="gap-1.5"
        >
          <Play className="h-3.5 w-3.5" />
          Play All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportPlaylistZip(getPlaylistExportUrl(id), `${playlist.name}.zip`)}
          disabled={playlist.songs.length === 0}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Export All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddSongsOpen(true)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Songs
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Playlist
        </Button>
      </div>

      <PlaylistSongList
        entries={playlist.songs}
        onReorder={(songIds) => reorderMutation.mutate(songIds)}
        onPlay={handlePlay}
        onRemove={(songId) => removeMutation.mutate(songId)}
      />

      <AddSongsDialog
        open={addSongsOpen}
        onOpenChange={setAddSongsOpen}
        existingSongIds={existingSongIds}
        onAdd={(songIds) => addMutation.mutate(songIds)}
        isAdding={addMutation.isPending}
      />

      <DeletePlaylistDialog
        playlist={playlist}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/playlists")}
      />
    </div>
  );
}
