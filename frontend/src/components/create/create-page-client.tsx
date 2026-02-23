"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useActiveBackend } from "@/hooks/use-active-backend";
import { fetchHealth } from "@/lib/api/client";
import { GenerationForm } from "./generation-form";
import { ResultsPanel } from "./results-panel";

function EngineInfoLine() {
  const { activeBackend, isReady, isLoading } = useActiveBackend();
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 5_000,
    retry: false,
  });

  const health = healthQuery.data;

  const loading = isLoading || !isReady;

  const label = loading
    ? "Engine loading"
    : activeBackend === "heartmula"
      ? "Engine: HeartMuLa 3B"
      : `Engine: ACE-Step ${health?.dit_model ? health.dit_model : ""}`.trim();

  return (
    <p className="text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-1.5 w-full">
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </p>
  );
}

export function CreatePageClient() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Create</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <GenerationForm />
        <div className="space-y-3">
          <ResultsPanel />
          <EngineInfoLine />
        </div>
      </div>
    </div>
  );
}
