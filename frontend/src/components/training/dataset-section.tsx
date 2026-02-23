"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, FolderOpen, HardDrive, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchDatasetConfigs, fetchDatasets, loadDatasetEmbeddedConfig } from "@/lib/api/client";
import { useTrainingStore } from "@/stores/training-store";
import { ConfigCard, BuiltDatasetCard } from "./dataset-card";
import { DatasetEditorDialog } from "./dataset-editor-dialog";
import { PreprocessDialog } from "./preprocess-dialog";

export function DatasetSection() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorConfigName, setEditorConfigName] = useState<string | null>(null);
  const [editorReadOnly, setEditorReadOnly] = useState(false);
  const [editorLoadFn, setEditorLoadFn] = useState<
    ((name: string) => Promise<import("@/types/api").DatasetConfig>) | undefined
  >(undefined);

  const [preprocessOpen, setPreprocessOpen] = useState(false);
  const [preprocessConfigName, setPreprocessConfigName] = useState("");
  const [preprocessAudioDir, setPreprocessAudioDir] = useState("");

  const config = useTrainingStore((s) => s.config);
  const setConfig = useTrainingStore((s) => s.setConfig);
  const status = useTrainingStore((s) => s.status);
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ["dataset-configs"],
    queryFn: fetchDatasetConfigs,
  });

  const { data: datasets = [] } = useQuery({
    queryKey: ["datasets"],
    queryFn: fetchDatasets,
  });

  // Refetch when preprocessing completes (status transitions from preprocessing -> idle)
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current === "preprocessing" && status === "idle") {
      queryClient.invalidateQueries({ queryKey: ["dataset-configs"] });
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    }
    prevStatusRef.current = status;
  }, [status, queryClient]);

  const handleNewDataset = () => {
    setEditorConfigName(null);
    setEditorReadOnly(false);
    setEditorLoadFn(undefined);
    setEditorOpen(true);
  };

  const handleEdit = (name: string) => {
    setEditorConfigName(name);
    setEditorReadOnly(false);
    setEditorLoadFn(undefined);
    setEditorOpen(true);
  };

  const handleViewConfig = (name: string) => {
    setEditorConfigName(name);
    setEditorReadOnly(true);
    setEditorLoadFn(() => loadDatasetEmbeddedConfig);
    setEditorOpen(true);
  };

  const handlePreprocess = (name: string, audioDir: string) => {
    setPreprocessConfigName(name);
    setPreprocessAudioDir(audioDir);
    setPreprocessOpen(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4" />
            Datasets
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewDataset}
          >
            <Plus className="mr-1 h-4 w-4" />
            New Config
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Dataset Configs ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Dataset Configs</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Configs define metadata (lyrics, captions, genre) for your audio.
            Edit a config, then preprocess it to build a training dataset.
          </p>
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No configs yet. Create one to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {configs.map((c) => (
                <ConfigCard
                  key={c.name}
                  config={c}
                  onEdit={() => handleEdit(c.name)}
                  onPreprocess={() => handlePreprocess(c.name, c.audio_dir)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Built Datasets ── */}
        {datasets.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Built Datasets</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Preprocessed datasets ready for training. Select one to use.
            </p>
            <div className="space-y-2">
              {datasets.map((ds) => (
                <BuiltDatasetCard
                  key={ds.name}
                  dataset={ds}
                  isSelected={config.datasetDir === ds.path}
                  hasConfig={ds.has_config}
                  onSelect={() => setConfig({ datasetDir: ds.path })}
                  onViewConfig={() => handleViewConfig(ds.name)}
                />
              ))}
            </div>
          </div>
        )}

        <DatasetEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          configName={editorConfigName}
          readOnly={editorReadOnly}
          loadFn={editorLoadFn}
        />

        <PreprocessDialog
          open={preprocessOpen}
          onOpenChange={setPreprocessOpen}
          configName={preprocessConfigName}
          audioDir={preprocessAudioDir}
        />
      </CardContent>
    </Card>
  );
}
