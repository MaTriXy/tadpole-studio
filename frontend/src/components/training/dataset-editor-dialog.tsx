"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderSearch, Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type {
  DatasetConfig,
  DatasetLevelMetadata,
  DatasetSample,
} from "@/types/api";
import {
  loadDatasetConfig,
  saveDatasetConfig,
  scanAudioDir,
} from "@/lib/api/client";
import { DatasetMetadataForm } from "./dataset-metadata-form";
import { DatasetEditorTable } from "./dataset-editor-table";

interface DatasetEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, loads this config directly into the editor (skip scan step). */
  configName: string | null;
  /** When true, all inputs are disabled and the save button is hidden. */
  readOnly?: boolean;
  /** Custom load function (defaults to loadDatasetConfig from configs dir). */
  loadFn?: (name: string) => Promise<DatasetConfig>;
}

const DEFAULT_METADATA: DatasetLevelMetadata = {
  custom_tag: "",
  tag_position: "prepend",
  genre_ratio: 0,
};

export function DatasetEditorDialog({
  open,
  onOpenChange,
  configName: initialConfigName,
  readOnly = false,
  loadFn = loadDatasetConfig,
}: DatasetEditorDialogProps) {
  const queryClient = useQueryClient();

  const isNewDataset = initialConfigName === null;

  // Scan state (only for new datasets)
  const [audioDir, setAudioDir] = useState("");
  const [name, setName] = useState("");

  // Editor state
  const [metadata, setMetadata] = useState<DatasetLevelMetadata>(DEFAULT_METADATA);
  const [samples, setSamples] = useState<DatasetSample[]>([]);
  const [editorReady, setEditorReady] = useState(false);

  // Dirty tracking
  const savedRef = useRef<string>("");
  const isDirty = useCallback(() => {
    if (readOnly) return false;
    const current = JSON.stringify({ metadata, samples });
    return current !== savedRef.current && samples.length > 0;
  }, [metadata, samples, readOnly]);

  // Confirm discard state
  const [confirmClose, setConfirmClose] = useState(false);

  // Load existing config when opening with a configName
  const loadMutation = useMutation({
    mutationFn: (n: string) => loadFn(n),
    onSuccess: (config) => {
      setAudioDir(config.audio_dir);
      setName(config.name);
      setMetadata(config.metadata);
      setSamples(config.samples);
      savedRef.current = JSON.stringify({
        metadata: config.metadata,
        samples: config.samples,
      });
      setEditorReady(true);
    },
    onError: (err) => {
      toast.error(`Load failed: ${err.message}`);
      onOpenChange(false);
    },
  });

  // Load config when dialog opens with a name, or reset for new dataset
  useEffect(() => {
    if (open && initialConfigName) {
      setEditorReady(false);
      loadMutation.reset();
      loadMutation.mutate(initialConfigName);
    }
    if (open && isNewDataset) {
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialConfigName]);

  // Scan mutation (new dataset flow)
  const scanMutation = useMutation({
    mutationFn: (dir: string) => scanAudioDir(dir),
    onSuccess: (files) => {
      const newSamples: DatasetSample[] = files.map((f) => ({
        filename: f.filename,
        audio_path: f.audio_path,
        caption: "",
        genre: "",
        lyrics: "[Instrumental]",
        bpm: null,
        keyscale: "",
        timesignature: "",
        duration: f.duration,
        is_instrumental: true,
        custom_tag: "",
        prompt_override: null,
      }));
      setSamples(newSamples);
      setMetadata(DEFAULT_METADATA);
      savedRef.current = "";
      if (!name) {
        const dirName = audioDir.split("/").filter(Boolean).pop() ?? "dataset";
        setName(dirName);
      }
      setEditorReady(true);
    },
    onError: (err) => toast.error(`Scan failed: ${err.message}`),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (config: DatasetConfig) => saveDatasetConfig(config),
    onSuccess: () => {
      savedRef.current = JSON.stringify({ metadata, samples });
      queryClient.invalidateQueries({ queryKey: ["dataset-configs"] });
      toast.success(`Config "${name}" saved`);
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Config name is required");
      return;
    }
    saveMutation.mutate({
      name,
      audio_dir: audioDir,
      metadata,
      samples,
    });
  };

  const resetState = () => {
    setAudioDir("");
    setName("");
    setMetadata(DEFAULT_METADATA);
    setSamples([]);
    setEditorReady(false);
    savedRef.current = "";
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty()) {
      setConfirmClose(true);
      return;
    }
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const handleSaveAndClose = async () => {
    if (!name.trim()) {
      toast.error("Config name is required");
      return;
    }
    try {
      await saveDatasetConfig({
        name,
        audio_dir: audioDir,
        metadata,
        samples,
      });
      savedRef.current = JSON.stringify({ metadata, samples });
      queryClient.invalidateQueries({ queryKey: ["dataset-configs"] });
      toast.success(`Config "${name}" saved`);
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
      return;
    }
    setConfirmClose(false);
    resetState();
    onOpenChange(false);
  };

  const handleConfirmDiscard = () => {
    setConfirmClose(false);
    resetState();
    onOpenChange(false);
  };

  const totalDuration = samples.reduce(
    (acc, s) => acc + (s.duration ?? 0),
    0,
  );

  const dialogTitle = readOnly
    ? `View: ${initialConfigName}`
    : isNewDataset
      ? "New Dataset"
      : `Edit: ${initialConfigName}`;

  const dialogDescription = readOnly
    ? "Read-only view of the dataset config metadata."
    : isNewDataset && !editorReady
      ? "Point to an audio directory and scan to create a new dataset config."
      : "Edit metadata for each sample. Save anytime.";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          {/* New dataset: scan form at top */}
          {isNewDataset && !editorReady && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Audio Directory</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="/path/to/audio/files"
                    value={audioDir}
                    onChange={(e) => setAudioDir(e.target.value)}
                  />
                  <Button
                    onClick={() => scanMutation.mutate(audioDir)}
                    disabled={!audioDir.trim() || scanMutation.isPending}
                  >
                    {scanMutation.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <FolderSearch className="mr-1 h-4 w-4" />
                    )}
                    Scan
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dataset Name</Label>
                <Input
                  placeholder="my-vocals"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Loading state for existing config */}
          {!isNewDataset && !editorReady && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Editor (shown for both new and existing once ready) */}
          {editorReady && (
            <div className="space-y-4">
              {/* For new datasets, show name field inline when editor is ready */}
              {isNewDataset && !readOnly && (
                <div className="space-y-2">
                  <Label>Dataset Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                {samples.length} files &middot;{" "}
                {Math.round(totalDuration / 60)}m total
              </div>

              <DatasetMetadataForm
                metadata={metadata}
                onChange={setMetadata}
                readOnly={readOnly}
              />

              <Separator />

              <DatasetEditorTable
                samples={samples}
                onChange={setSamples}
                readOnly={readOnly}
              />

              {!readOnly && (
                <div className="flex items-center justify-end pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm discard unsaved changes */}
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Discard them and close?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
            <AlertDialogAction onClick={handleSaveAndClose}>
              Save &amp; Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
