import type { ThemeDefinition } from "./types";

export const ember = {
  id: "ember",
  name: "Ember",
  description: "Warm amber glow, media center vibes",
  colorScheme: "dark",
  preview: { bg: "#2a2318", sidebar: "#221c13", primary: "#f59e0b" },
} as const satisfies ThemeDefinition;
