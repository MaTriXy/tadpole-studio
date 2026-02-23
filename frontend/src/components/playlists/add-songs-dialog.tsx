"use client";

import { useState, useMemo } from "react";
import { Search, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchSongs } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface AddSongsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSongIds: string[];
  onAdd: (songIds: string[]) => void;
  isAdding?: boolean;
}

export function AddSongsDialog({
  open,
  onOpenChange,
  existingSongIds,
  onAdd,
  isAdding,
}: AddSongsDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: songsData, isLoading } = useQuery({
    queryKey: ["songs", { search }],
    queryFn: () => fetchSongs({ search: search || undefined }),
    enabled: open,
  });

  const songs = songsData?.items ?? [];

  const availableSongs = useMemo(
    () => songs.filter((s) => !existingSongIds.includes(s.id)),
    [songs, existingSongIds],
  );

  const toggleSong = (songId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });
  };

  const handleAdd = () => {
    onAdd(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSearch("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedIds(new Set());
      setSearch("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Songs</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search songs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : availableSongs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No songs available to add
            </p>
          ) : (
            availableSongs.map((song) => (
              <button
                key={song.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent/50",
                  selectedIds.has(song.id) && "bg-primary/10 border border-primary/30",
                )}
                onClick={() => toggleSong(song.id)}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                    selectedIds.has(song.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30",
                  )}
                >
                  {selectedIds.has(song.id) && (
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{song.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {song.caption || "No description"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedIds.size === 0 || isAdding}
          >
            {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
