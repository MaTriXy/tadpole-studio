"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSettingsStore } from "@/stores/settings-store";
import { THEMES, THEME_IDS } from "@/themes";
import { fetchSettings, fetchCustomThemes } from "@/lib/api/client";
import type { CustomThemeResponse } from "@/lib/api/client";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);
  const prevCustomThemeIdsRef = useRef<string[]>([]);

  // Sync theme from backend on mount (cross-browser persistence)
  useEffect(() => {
    fetchSettings()
      .then((res) => {
        const backendTheme = res.settings.theme;
        if (backendTheme && (THEME_IDS as readonly string[]).includes(backendTheme)) {
          useSettingsStore.setState({ theme: backendTheme as typeof theme });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch custom themes
  const { data: customThemes } = useQuery({
    queryKey: ["custom-themes"],
    queryFn: fetchCustomThemes,
    staleTime: 30_000,
  });

  // Inject custom theme CSS into <head>
  useLayoutEffect(() => {
    if (!customThemes) return;

    // Remove old custom theme styles
    const oldStyles = document.querySelectorAll("style[data-custom-theme]");
    oldStyles.forEach((el) => el.remove());

    // Inject new custom theme styles
    for (const ct of customThemes) {
      const style = document.createElement("style");
      style.setAttribute("data-custom-theme", ct.id);
      style.textContent = ct.css;
      document.head.appendChild(style);
    }

    prevCustomThemeIdsRef.current = customThemes.map((ct) => ct.id);
  }, [customThemes]);

  // Apply active theme
  useLayoutEffect(() => {
    const html = document.documentElement;
    if (theme === "midnight") {
      html.removeAttribute("data-theme");
    } else {
      html.setAttribute("data-theme", theme);
    }

    // Check built-in themes first, then custom themes
    const builtInDef = THEMES.find((t) => t.id === theme);
    let colorScheme: "dark" | "light" = "dark";
    if (builtInDef) {
      colorScheme = builtInDef.colorScheme;
    } else if (customThemes) {
      const customDef = customThemes.find((t) => t.id === theme);
      if (customDef) {
        colorScheme = customDef.color_scheme as "dark" | "light";
      }
    }

    const isDark = colorScheme === "dark";
    html.style.colorScheme = isDark ? "dark" : "light";
    html.classList.toggle("dark", isDark);
  }, [theme, customThemes]);

  return <>{children}</>;
}
