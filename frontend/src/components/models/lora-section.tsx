"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchLoras,
  fetchLoraStatus,
  addToLibrary,
  forgetAdapter,
} from "@/lib/api/client";
import { LoraCard } from "./lora-card";
import { LoadLoraDialog } from "./load-lora-dialog";

export function LoraSection() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: availableLoras = [] } = useQuery({
    queryKey: ["loras"],
    queryFn: fetchLoras,
  });

  const { data: status } = useQuery({
    queryKey: ["lora-status"],
    queryFn: fetchLoraStatus,
    refetchInterval: 3000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["lora-status"] });
    queryClient.invalidateQueries({ queryKey: ["loras"] });
  };

  const addMutation = useMutation({
    mutationFn: ({ path, name }: { path: string; name?: string }) =>
      addToLibrary(path, name),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidate();
      setDialogOpen(false);
    },
    onError: (err) => toast.error(`Add failed: ${err.message}`),
  });

  const forgetMutation = useMutation({
    mutationFn: (name: string) => forgetAdapter(name),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidate();
    },
    onError: (err) => toast.error(`Remove failed: ${err.message}`),
  });

  const knownAdapters = status?.known_adapters ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">LoRA Adapters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {knownAdapters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No adapters added</p>
        ) : (
          <div className="space-y-2">
            {knownAdapters.map((adapter) => (
              <LoraCard
                key={adapter.name}
                name={adapter.name}
                adapterType={adapter.adapter_type}
                onRemove={() => forgetMutation.mutate(adapter.name)}
              />
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Adapter
          </Button>
        </div>

        <LoadLoraDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          availableLoras={availableLoras}
          onLoad={async (path, name) => {
            await addMutation.mutateAsync({ path, name });
          }}
          isLoading={addMutation.isPending}
        />
      </CardContent>
    </Card>
  );
}
