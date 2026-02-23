"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPlaylist, addSongsToPlaylist } from "@/lib/api/client";

interface SaveToPlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  songIds: string[];
}

export function SaveToPlaylistDialog({
  open,
  onOpenChange,
  defaultName,
  songIds,
}: SaveToPlaylistDialogProps) {
  const [name, setName] = useState(defaultName);
  const queryClient = useQueryClient();

  // Sync name when dialog opens with new defaultName
  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const mutation = useMutation({
    mutationFn: async () => {
      const playlist = await createPlaylist({ name: name.trim() });
      if (songIds.length > 0) {
        await addSongsToPlaylist(playlist.id, songIds);
      }
      return playlist;
    },
    onSuccess: (playlist) => {
      toast.success(
        `Created "${playlist.name}" with ${songIds.length} track${songIds.length === 1 ? "" : "s"}`,
      );
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to create playlist");
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onOpenChange(false);
      return;
    }
    setName(defaultName);
    onOpenChange(true);
  };

  // Sync default name when dialog opens with new props
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save to New Playlist</DialogTitle>
            <DialogDescription>
              {songIds.length === 1
                ? "Create a new playlist with this track."
                : `Create a new playlist with ${songIds.length} tracks.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="playlist-name">Name</Label>
              <Input
                id="playlist-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Playlist name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Playlist
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
