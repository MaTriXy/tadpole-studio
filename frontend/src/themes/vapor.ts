import type { ThemeDefinition } from "./types";

export const vapor = {
  id: "vapor",
  name: "Vapor",
  description: "A E S T H E T I C pink + teal vaporwave",
  colorScheme: "dark",
  preview: {
    bg: "#1a1233",
    sidebar: "#140e2b",
    primary: "#f050a0",
  },
} as const satisfies ThemeDefinition;
