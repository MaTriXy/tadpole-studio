import type { ThemeDefinition } from "./types";

export const sakura = {
  id: "sakura",
  name: "Sakura",
  description: "Soft pastel pink, kawaii and dreamy",
  colorScheme: "light",
  preview: { bg: "#e4ced5", sidebar: "#dbc5cd", primary: "#ec4899" },
} as const satisfies ThemeDefinition;
