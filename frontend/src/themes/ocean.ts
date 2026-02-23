import type { ThemeDefinition } from "./types";

export const ocean = {
  id: "ocean",
  name: "Ocean",
  description: "Deep blue, frosted glass and chrome",
  colorScheme: "dark",
  preview: { bg: "#131b2b", sidebar: "#0f1725", primary: "#3b82f6" },
} as const satisfies ThemeDefinition;
