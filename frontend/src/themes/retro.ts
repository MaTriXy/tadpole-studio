import type { ThemeDefinition } from "./types";

export const retro = {
  id: "retro",
  name: "Retro",
  description: "Yellow-green terminal, old-school cool",
  colorScheme: "dark",
  preview: { bg: "#1c1b12", sidebar: "#17160e", primary: "#d4ef32" },
} as const satisfies ThemeDefinition;
