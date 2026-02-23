import type { ThemeDefinition } from "./types";

export const daylight = {
  id: "daylight",
  name: "Daylight",
  description: "Clean and bright, white and cool gray",
  colorScheme: "light",
  preview: { bg: "#f8fafc", sidebar: "#f1f5f9", primary: "#4f7df5" },
} as const satisfies ThemeDefinition;
