"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import type { LoraInfo } from "@/types/api";

interface LoadLoraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableLoras: LoraInfo[];
  onLoad: (path: string, name?: string) => Promise<void>;
  isLoading: boolean;
}

interface LoraGroups {
  ungrouped: LoraInfo[];
  groups: Map<string, LoraInfo[]>;
}

function groupLoras(loras: LoraInfo[]): LoraGroups {
  const ungrouped: LoraInfo[] = [];
  const groups = new Map<string, LoraInfo[]>();

  for (const lora of loras) {
    const slashIndex = lora.name.indexOf("/");
    if (slashIndex === -1) {
      ungrouped.push(lora);
    } else {
      const runName = lora.name.slice(0, slashIndex);
      const existing = groups.get(runName);
      if (existing) {
        existing.push(lora);
      } else {
        groups.set(runName, [lora]);
      }
    }
  }

  return { ungrouped, groups };
}

function LoraItem({
  lora,
  onLoad,
  disabled,
}: {
  lora: LoraInfo;
  onLoad: (lora: LoraInfo) => void;
  disabled: boolean;
}) {
  return (
    <button
      key={lora.path}
      type="button"
      className="flex w-full items-center justify-between rounded-md border border-border p-2 text-left hover:bg-accent"
      onClick={() => onLoad(lora)}
      disabled={disabled}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{lora.name}</span>
        <Badge variant="outline" className="text-xs">
          {lora.adapter_type}
        </Badge>
      </div>
      <span className="text-xs text-muted-foreground">
        {lora.size_mb.toFixed(1)} MB
      </span>
    </button>
  );
}

export function LoadLoraDialog({
  open,
  onOpenChange,
  availableLoras,
  onLoad,
  isLoading,
}: LoadLoraDialogProps) {
  const [customPath, setCustomPath] = useState("");
  const [customName, setCustomName] = useState("");
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);

  const { ungrouped, groups } = useMemo(
    () => groupLoras(availableLoras),
    [availableLoras],
  );

  const handleLoadFromScan = async (lora: LoraInfo) => {
    await onLoad(lora.path, lora.name);
  };

  const handleLoadAll = async (runName: string, loras: LoraInfo[]) => {
    setLoadingGroup(runName);
    try {
      for (const lora of loras) {
        await onLoad(lora.path, lora.name);
      }
    } finally {
      setLoadingGroup(null);
    }
  };

  const handleLoadCustom = async () => {
    if (!customPath.trim()) return;
    await onLoad(customPath.trim(), customName.trim() || undefined);
    setCustomPath("");
    setCustomName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Adapter to Library</DialogTitle>
          <DialogDescription>
            Select from available adapters or enter a custom path.
          </DialogDescription>
        </DialogHeader>

        {availableLoras.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Available Adapters</Label>
            <div className="space-y-1">
              {ungrouped.map((lora) => (
                <LoraItem
                  key={lora.path}
                  lora={lora}
                  onLoad={handleLoadFromScan}
                  disabled={isLoading}
                />
              ))}

              {[...groups.entries()].map(([runName, loras]) => (
                <div key={runName} className="space-y-1">
                  <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5">
                    <span className="text-sm font-semibold">{runName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      disabled={isLoading}
                      onClick={() => handleLoadAll(runName, loras)}
                    >
                      {loadingGroup === runName ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : null}
                      Add All
                    </Button>
                  </div>
                  <div className="space-y-1 pl-3">
                    {loras.map((lora) => (
                      <LoraItem
                        key={lora.path}
                        lora={lora}
                        onLoad={handleLoadFromScan}
                        disabled={isLoading}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-3">
          <Label className="text-sm font-medium">Custom Path</Label>
          <Input
            placeholder="/path/to/lora/adapter"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
          />
          <Input
            placeholder="Adapter name (optional)"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLoadCustom}
            disabled={isLoading || !customPath.trim()}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
