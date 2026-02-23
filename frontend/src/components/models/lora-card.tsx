"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LoraCardProps {
  name: string;
  adapterType: string;
  onRemove: () => void;
}

export function LoraCard({ name, adapterType, onRemove }: LoraCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <span className="text-sm font-medium">{name}</span>
      <Badge variant="outline" className="text-xs">
        {adapterType}
      </Badge>

      <div className="ml-auto">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
