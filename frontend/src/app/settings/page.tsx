"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Server, CheckCircle2, XCircle, Loader2, Palette, Radio, RotateCcw, Music } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore } from "@/stores/settings-store";
import { fetchHealth, fetchSettings, updateSettings } from "@/lib/api/client";
import { fetchVaeThrottle, updateVaeThrottle, fetchDitThrottle, updateDitThrottle, resetThrottle, fetchThrottleScope, updateThrottleScope } from "@/lib/api/radio-client";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ThemePicker } from "@/components/settings/theme-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SettingsPage() {
  const { backendUrl, setBackendUrl } = useSettingsStore();
  const [urlInput, setUrlInput] = useState(backendUrl);
  const queryClient = useQueryClient();

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 5_000,
    retry: false,
  });

  const serverSettingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    enabled: healthQuery.isSuccess,
  });

  const settingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const handleSaveUrl = () => {
    setBackendUrl(urlInput);
    queryClient.invalidateQueries({ queryKey: ["health"] });
    toast.success("Backend URL updated");
  };

  const vaeThrottleQuery = useQuery({
    queryKey: ["vae-throttle"],
    queryFn: fetchVaeThrottle,
    enabled: healthQuery.isSuccess,
  });

  const vaeThrottleMutation = useMutation({
    mutationFn: updateVaeThrottle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vae-throttle"] });
      toast.success("Radio GPU settings saved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const ditThrottleQuery = useQuery({
    queryKey: ["dit-throttle"],
    queryFn: fetchDitThrottle,
    enabled: healthQuery.isSuccess,
  });

  const ditThrottleMutation = useMutation({
    mutationFn: updateDitThrottle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dit-throttle"] });
      toast.success("DiT throttle saved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const throttleResetMutation = useMutation({
    mutationFn: resetThrottle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vae-throttle"] });
      queryClient.invalidateQueries({ queryKey: ["dit-throttle"] });
      queryClient.invalidateQueries({ queryKey: ["throttle-scope"] });
      toast.success("Throttle settings reset to defaults");
    },
    onError: (err: Error) => {
      toast.error(`Failed to reset: ${err.message}`);
    },
  });

  const throttleScopeQuery = useQuery({
    queryKey: ["throttle-scope"],
    queryFn: fetchThrottleScope,
    enabled: healthQuery.isSuccess,
  });

  const throttleScopeMutation = useMutation({
    mutationFn: updateThrottleScope,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["throttle-scope"] });
      toast.success("Throttle scope updated");
    },
    onError: (err: Error) => {
      toast.error(`Failed to update: ${err.message}`);
    },
  });

  // Local slider state (synced from server, updated during drag)
  const [vaeChunkSize, setVaeChunkSize] = useState(128);
  const [vaeSleepMs, setVaeSleepMs] = useState(200);
  const [ditSleepMs, setDitSleepMs] = useState(200);

  useEffect(() => {
    if (vaeThrottleQuery.data) {
      setVaeChunkSize(vaeThrottleQuery.data.chunk_size);
      setVaeSleepMs(vaeThrottleQuery.data.sleep_ms);
    }
  }, [vaeThrottleQuery.data]);

  useEffect(() => {
    if (ditThrottleQuery.data) {
      setDitSleepMs(ditThrottleQuery.data.sleep_ms);
    }
  }, [ditThrottleQuery.data]);

  const health = healthQuery.data;
  const connected = healthQuery.isSuccess;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose a theme to personalize the look and feel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>

      {/* Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Backend Connection
          </CardTitle>
          <CardDescription>
            Configure the URL for the Tadpole Studio backend server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backend-url">Backend URL</Label>
            <div className="flex gap-2">
              <Input
                id="backend-url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="http://localhost:8000"
              />
              <Button onClick={handleSaveUrl} variant="secondary">
                Save
              </Button>
            </div>
          </div>

          <Separator />

          {/* Health status */}
          <div className="space-y-3">
            <Label>Server Status</Label>
            {healthQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking connection...
              </div>
            ) : connected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">Connected</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    v{health?.version}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/50 p-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Device:</span>{" "}
                    <span className="font-medium">{health?.device || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Backend:</span>{" "}
                    <span className="font-medium">
                      {health?.active_backend === "heartmula" ? "HeartMuLa" : "ACE-Step"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">DiT Model:</span>{" "}
                    <span className="font-medium">
                      {health?.dit_model || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">DiT:</span>
                    {health?.dit_model_loaded ? (
                      <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                        Loaded
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                        Loading...
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">LM:</span>
                    {health?.lm_model_loaded ? (
                      <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                        Loaded
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                        Loading...
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                Cannot connect to backend
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Server settings (from SQLite) */}
      {connected && serverSettingsQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Defaults</CardTitle>
            <CardDescription>
              Default values for music generation. Stored on the backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(serverSettingsQuery.data.settings).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 overflow-hidden rounded-lg bg-secondary/50 px-3 py-2"
                  >
                    <span className="shrink-0 text-muted-foreground">{key}</span>
                    <span className="truncate font-mono text-xs" title={value}>{value}</span>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* HeartMuLa Configuration */}
      {connected && serverSettingsQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              HeartMuLa
            </CardTitle>
            <CardDescription>
              Configure the HeartMuLa music generation backend for superior lyrics controllability.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="heartmula-model-path">Model Path</Label>
              <div className="flex gap-2">
                <Input
                  id="heartmula-model-path"
                  defaultValue={serverSettingsQuery.data.settings.heartmula_model_path ?? ""}
                  placeholder="Path to HeartMuLa model directory"
                  onBlur={(e) =>
                    settingsMutation.mutate({ heartmula_model_path: e.target.value })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Set this to the directory containing the HeartMuLa model files. Leave empty to disable.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Version</Label>
                <Select
                  value={serverSettingsQuery.data.settings.heartmula_version ?? "3B"}
                  onValueChange={(v) =>
                    settingsMutation.mutate({ heartmula_version: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3B">3B</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2 pb-1">
                <Switch
                  id="heartmula-lazy-load"
                  checked={serverSettingsQuery.data.settings.heartmula_lazy_load === "true"}
                  onCheckedChange={(v) =>
                    settingsMutation.mutate({ heartmula_lazy_load: v ? "true" : "false" })
                  }
                />
                <Label htmlFor="heartmula-lazy-load" className="cursor-pointer">
                  Lazy Load
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GPU Throttle */}
      {connected && vaeThrottleQuery.data && ditThrottleQuery.data && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5" />
                  GPU Throttle
                </CardTitle>
                <CardDescription>
                  Adds pauses between GPU-intensive steps to prevent audio
                  stuttering on Apple Silicon unified memory. Higher pause
                  values and smaller chunk sizes keep playback smooth but slow
                  down generation. If you don&apos;t hear any stuttering, reduce
                  pauses or increase chunk size for faster generation.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => throttleResetMutation.mutate()}
                disabled={throttleResetMutation.isPending}
                className="shrink-0"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {throttleScopeQuery.data && (
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="radio-only">Radio only</Label>
                  <p className="text-xs text-muted-foreground">
                    Only throttle during radio playback. Normal generation runs at full speed.
                  </p>
                </div>
                <Switch
                  id="radio-only"
                  checked={throttleScopeQuery.data.radio_only}
                  onCheckedChange={(checked) =>
                    throttleScopeMutation.mutate({ radio_only: checked })
                  }
                />
              </div>
            )}

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">DiT Diffusion</Label>
              <p className="text-xs text-muted-foreground">
                Each song requires 8 transformer forward passes on the GPU.
                A pause between steps lets the audio thread run uninterrupted.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Pause between steps</Label>
                <span className="font-mono text-xs text-muted-foreground">
                  {ditSleepMs} ms
                </span>
              </div>
              <Slider
                value={[ditSleepMs]}
                min={0}
                max={500}
                step={25}
                onValueChange={([v]) => setDitSleepMs(v)}
                onValueCommit={([v]) =>
                  ditThrottleMutation.mutate({ sleep_ms: v })
                }
              />
              <p className="text-xs text-muted-foreground">
                Higher = smoother playback, slower generation.
                0 ms = no pause (fastest, may stutter).
              </p>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">VAE Decode</Label>
              <p className="text-xs text-muted-foreground">
                After diffusion, the VAE converts latents into audio. The decode
                is split into chunks with pauses between them so the GPU
                doesn&apos;t monopolize memory bandwidth.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Chunk size</Label>
                <span className="font-mono text-xs text-muted-foreground">
                  {vaeChunkSize} frames
                </span>
              </div>
              <Slider
                value={[vaeChunkSize]}
                min={128}
                max={2048}
                step={128}
                onValueChange={([v]) => setVaeChunkSize(v)}
                onValueCommit={([v]) =>
                  vaeThrottleMutation.mutate({
                    chunk_size: v,
                    sleep_ms: vaeSleepMs,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Smaller = more pauses, smoother playback.
                Larger = fewer pauses, faster generation.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Pause between chunks</Label>
                <span className="font-mono text-xs text-muted-foreground">
                  {vaeSleepMs} ms
                </span>
              </div>
              <Slider
                value={[vaeSleepMs]}
                min={0}
                max={500}
                step={25}
                onValueChange={([v]) => setVaeSleepMs(v)}
                onValueCommit={([v]) =>
                  vaeThrottleMutation.mutate({
                    chunk_size: vaeChunkSize,
                    sleep_ms: v,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Higher = smoother playback, slower generation.
                0 ms = no pause (fastest, may stutter).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keyboard shortcuts reference */}
      <Card>
        <CardHeader>
          <CardTitle>Keyboard Shortcuts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["Space", "Play / Pause"],
              ["M", "Mute / Unmute"],
              ["N", "Next track"],
              ["P", "Previous track"],
              ["\u2190 / \u2192", "Seek -5s / +5s"],
              ["\u2191 / \u2193", "Volume up / down"],
              ["F", "Toggle favorite"],
              ["1-5", "Rate current song"],
              ["Ctrl+Enter", "Generate"],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="inline-flex h-6 min-w-[28px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs">
                  {key}
                </kbd>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
