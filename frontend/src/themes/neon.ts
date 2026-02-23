import type { ThemeDefinition } from "./types";

export const neon = {
  id: "neon",
  name: "Neon",
  description: "Electric lime, hacker terminal glow",
  colorScheme: "dark",
  preview: { bg: "#0f1310", sidebar: "#0b0f0c", primary: "#39ff14" },
} as const satisfies ThemeDefinition;
