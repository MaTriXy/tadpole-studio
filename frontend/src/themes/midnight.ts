import type { ThemeDefinition } from "./types";

export const midnight = {
  id: "midnight",
  name: "Midnight",
  description: "Purple accent, sophisticated and modern",
  colorScheme: "dark",
  preview: { bg: "#1a1a2e", sidebar: "#151527", primary: "#8b5cf6" },
} as const satisfies ThemeDefinition;
