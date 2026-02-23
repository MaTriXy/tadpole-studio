"use client";

import { AlertTriangle, Database, Eye, HardDrive, Pencil, Play, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteDataset, deleteDatasetConfig } from "@/lib/api/client";
import type { DatasetConfigSummary, DatasetInfo } from "@/types/api";
import { useState } from "react";

// ── Config Card ────────────────────────────────────────────

interface ConfigCardProps {
  config: DatasetConfigSummary;
  onEdit: () => void;
  onPreprocess: () => void;
}

export function ConfigCard({ config, onEdit, onPreprocess }: ConfigCardProps) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteDatasetConfig(config.name),
    onSuccess: () => {
      toast.success(`Deleted config: ${config.name}`);
      queryClient.invalidateQueries({ queryKey: ["dataset-configs"] });
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  return (
    <>
      <div className="flex w-full items-center justify-between rounded-lg border border-border/50 p-3">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{config.name}</span>
          {config.audio_dir_missing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Audio directory not found</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline">{config.sample_count} files</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            title="Edit metadata"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${config.audio_dir_missing ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"}`}
            onClick={onPreprocess}
            disabled={config.audio_dir_missing}
            title={config.audio_dir_missing ? "Audio directory missing" : "Preprocess"}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending}
            title="Delete config"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Config</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the config "{config.name}" ({config.sample_count} files).
              Built datasets using this config will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false);
                deleteMutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Built Dataset Card ─────────────────────────────────────

interface BuiltDatasetCardProps {
  dataset: DatasetInfo;
  isSelected: boolean;
  hasConfig: boolean;
  onSelect: () => void;
  onViewConfig: () => void;
}

export function BuiltDatasetCard({
  dataset,
  isSelected,
  hasConfig,
  onSelect,
  onViewConfig,
}: BuiltDatasetCardProps) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteDataset(dataset.name),
    onSuccess: () => {
      toast.success(`Deleted dataset: ${dataset.name}`);
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors cursor-pointer ${
          isSelected
            ? "border-primary bg-primary/5"
            : "border-border hover:bg-accent"
        }`}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect();
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{dataset.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline">{dataset.sample_count} samples</Badge>
          <span className="text-xs text-muted-foreground">
            {dataset.size_mb.toFixed(1)} MB
          </span>
          {hasConfig && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onViewConfig();
              }}
              title="View config"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            disabled={deleteMutation.isPending}
            title="Delete dataset"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Built Dataset</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the preprocessed dataset "{dataset.name}" ({dataset.size_mb.toFixed(1)} MB).
              The config file will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false);
                deleteMutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
