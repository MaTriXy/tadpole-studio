"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PlaylistResponse } from "@/types/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import { getPlaylistIcon } from "./icon-picker";

interface PlaylistCardProps {
  playlist: PlaylistResponse;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PlaylistCard({ playlist, onClick, onEdit, onDelete }: PlaylistCardProps) {
  const Icon = getPlaylistIcon(playlist.icon);

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 pt-8 cursor-pointer transition-colors hover:bg-accent/50",
      )}
      onClick={onClick}
    >
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-7 w-7 text-primary" />
      </div>

      <div className="flex w-full flex-col items-center gap-1">
        <p className="line-clamp-2 text-center text-sm font-medium leading-tight">
          {playlist.name}
        </p>
        {playlist.description && (
          <p className="w-full truncate text-center text-xs text-muted-foreground">
            {playlist.description}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {playlist.song_count} {playlist.song_count === 1 ? "song" : "songs"}
        {" \u00b7 "}
        {formatRelativeTime(playlist.created_at)}
      </p>
    </div>
  );
}
