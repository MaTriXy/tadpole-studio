"use client";

import { useState, useEffect } from "react";
import { Search, ArrowUpDown, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PlaylistsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  order: string;
  onOrderToggle: () => void;
  totalCount: number;
  onCreateClick: () => void;
}

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "created_at", label: "Date Added" },
];

export function PlaylistsToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  order,
  onOrderToggle,
  totalCount,
  onCreateClick,
}: PlaylistsToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search playlists..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={sort} onValueChange={onSortChange}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={onOrderToggle} className="gap-1.5">
        <ArrowUpDown className="h-3.5 w-3.5" />
        {order === "asc" ? "Asc" : "Desc"}
      </Button>

      <Badge variant="secondary">{totalCount} playlists</Badge>

      <Button size="sm" onClick={onCreateClick} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        New Playlist
      </Button>
    </div>
  );
}
