"use client";

import { useRef } from "react";
import { Check, Upload, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { THEMES, type ThemeId } from "@/themes";
import { useSettingsStore } from "@/stores/settings-store";
import { fetchCustomThemes, createCustomTheme, deleteCustomTheme } from "@/lib/api/client";
import type { CustomThemeResponse } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function parseThemeCss(css: string): { id: string; bg: string; sidebar: string; primary: string; colorScheme: "dark" | "light" } | null {
  // Extract theme ID from html[data-theme="..."]
  const idMatch = css.match(/html\[data-theme=["']([^"']+)["']\]/);
  if (!idMatch) return null;
  const id = idMatch[1];

  // Extract preview colors from CSS variables
  const extractVar = (name: string): string => {
    const regex = new RegExp(`--${name}:\\s*([^;]+);`);
    const match = css.match(regex);
    return match ? match[1].trim() : "";
  };

  const bg = extractVar("background") || "#1a1a2e";
  const sidebar = extractVar("sidebar") || "#151527";
  const primary = extractVar("primary") || "#8b5cf6";

  // Detect color scheme from lightness
  const colorScheme = css.includes("color-scheme: light") ? "light" as const : "dark" as const;

  return { id, bg, sidebar, primary, colorScheme };
}

export function ThemePicker() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: customThemes = [] } = useQuery({
    queryKey: ["custom-themes"],
    queryFn: fetchCustomThemes,
  });

  const createMutation = useMutation({
    mutationFn: createCustomTheme,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-themes"] });
      toast.success("Theme imported successfully");
    },
    onError: (err: Error) => {
      toast.error(`Failed to import theme: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomTheme,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-themes"] });
      toast.success("Theme deleted");
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete theme: ${err.message}`);
    },
  });

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const css = await file.text();
      const parsed = parseThemeCss(css);
      if (!parsed) {
        toast.error("Invalid theme CSS. Expected html[data-theme=\"...\"] selector.");
        return;
      }

      const name = parsed.id
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      createMutation.mutate({
        name,
        css,
        color_scheme: parsed.colorScheme,
        preview_bg: parsed.bg,
        preview_sidebar: parsed.sidebar,
        preview_primary: parsed.primary,
      });
    } catch {
      toast.error("Failed to read theme file");
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = (e: React.MouseEvent, ct: CustomThemeResponse) => {
    e.stopPropagation();
    // If deleting the active theme, switch to default
    if (theme === ct.id) {
      setTheme("midnight");
    }
    deleteMutation.mutate(ct.id);
  };

  return (
    <div>
      {/* Built-in themes */}
      <div className="grid grid-cols-4 gap-3">
        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "group relative flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30 hover:bg-accent/50",
              )}
            >
              <div className="flex w-full gap-1 overflow-hidden rounded-md border border-border/50">
                <div
                  className="h-10 w-3 shrink-0"
                  style={{ backgroundColor: t.preview.sidebar }}
                />
                <div
                  className="flex h-10 flex-1 items-end p-1"
                  style={{ backgroundColor: t.preview.bg }}
                >
                  <div
                    className="h-2 w-full rounded-sm"
                    style={{ backgroundColor: t.preview.primary }}
                  />
                </div>
              </div>

              <div className="w-full">
                <p className="text-xs font-medium">{t.name}</p>
                <p className="text-[10px] leading-tight text-muted-foreground">
                  {t.description}
                </p>
              </div>

              {active && (
                <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom themes */}
      {(customThemes.length > 0 || true) && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Custom Themes</h3>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".css"
                onChange={handleImport}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={createMutation.isPending}
              >
                <Upload className="h-3.5 w-3.5" />
                Import Theme
              </Button>
            </div>
          </div>

          {customThemes.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {customThemes.map((ct) => {
                const active = theme === ct.id;
                return (
                  <button
                    key={ct.id}
                    onClick={() => setTheme(ct.id as ThemeId)}
                    className={cn(
                      "group relative flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30 hover:bg-accent/50",
                    )}
                  >
                    <div className="flex w-full gap-1 overflow-hidden rounded-md border border-border/50">
                      <div
                        className="h-10 w-3 shrink-0"
                        style={{ backgroundColor: ct.preview_sidebar }}
                      />
                      <div
                        className="flex h-10 flex-1 items-end p-1"
                        style={{ backgroundColor: ct.preview_bg }}
                      >
                        <div
                          className="h-2 w-full rounded-sm"
                          style={{ backgroundColor: ct.preview_primary }}
                        />
                      </div>
                    </div>

                    <div className="w-full">
                      <p className="text-xs font-medium">{ct.name}</p>
                      <p className="text-[10px] leading-tight text-muted-foreground">
                        Custom
                      </p>
                    </div>

                    {active && (
                      <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </div>
                    )}

                    {/* Delete button on hover */}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, ct)}
                      className="absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </button>
                );
              })}
            </div>
          )}

          {customThemes.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No custom themes installed. Import a .css file to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
