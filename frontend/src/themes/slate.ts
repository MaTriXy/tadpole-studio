import type { ThemeDefinition } from "./types";

export const slate = {
  id: "slate",
  name: "Slate",
  description: "Beveled edges, utilitarian high contrast",
  colorScheme: "dark",
  preview: {
    bg: "#2a2b33",
    sidebar: "#22232a",
    primary: "#5c7ae6",
  },
} as const satisfies ThemeDefinition;
