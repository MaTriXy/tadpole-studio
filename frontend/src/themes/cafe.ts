import type { ThemeDefinition } from "./types";

export const cafe = {
  id: "cafe",
  name: "Cafe",
  description: "Warm beige, mocha and espresso tones",
  colorScheme: "light",
  preview: { bg: "#f5f0e8", sidebar: "#ebe4d8", primary: "#b8860b" },
} as const satisfies ThemeDefinition;
