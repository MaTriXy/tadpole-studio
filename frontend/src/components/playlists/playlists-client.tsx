"use client";

import { useState, useCallback } from "react";
import { ListMusic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchPlaylists } from "@/lib/api/client";
import type { PlaylistResponse } from "@/types/api";
import { PlaylistsToolbar } from "./playlists-toolbar";
import { PlaylistGrid } from "./playlist-grid";
import { CreatePlaylistDialog } from "./create-playlist-dialog";
import { EditPlaylistDialog } from "./edit-playlist-dialog";
import { DeletePlaylistDialog } from "./delete-playlist-dialog";

export function PlaylistsClient() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistResponse | null>(null);
  const [deletingPlaylist, setDeletingPlaylist] = useState<PlaylistResponse | null>(null);

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ["playlists", { search, sort, order }],
    queryFn: () =>
      fetchPlaylists({
        search: search || undefined,
        sort,
        order,
      }),
  });

  const handlePlaylistClick = useCallback(
    (playlist: PlaylistResponse) => {
      router.push(`/playlists/${playlist.id}`);
    },
    [router],
  );

  const handleOrderToggle = useCallback(() => {
    setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ListMusic className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Playlists</h1>
      </div>

      <PlaylistsToolbar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        order={order}
        onOrderToggle={handleOrderToggle}
        totalCount={playlists.length}
        onCreateClick={() => setCreateDialogOpen(true)}
      />

      <PlaylistGrid
        playlists={playlists}
        isLoading={isLoading}
        onPlaylistClick={handlePlaylistClick}
        onEditPlaylist={setEditingPlaylist}
        onDeletePlaylist={setDeletingPlaylist}
      />

      <CreatePlaylistDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <EditPlaylistDialog
        playlist={editingPlaylist}
        open={editingPlaylist !== null}
        onOpenChange={(open) => {
          if (!open) setEditingPlaylist(null);
        }}
      />
      <DeletePlaylistDialog
        playlist={deletingPlaylist}
        open={deletingPlaylist !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingPlaylist(null);
        }}
      />
    </div>
  );
}
