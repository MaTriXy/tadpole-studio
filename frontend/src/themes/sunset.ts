import type { ThemeDefinition } from "./types";

export const sunset = {
  id: "sunset",
  name: "Sunset",
  description: "80s synthwave, neon orange + cyan",
  colorScheme: "dark",
  preview: {
    bg: "#150a20",
    sidebar: "#100818",
    primary: "#f07030",
  },
} as const satisfies ThemeDefinition;
