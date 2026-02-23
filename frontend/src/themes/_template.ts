/* How to add a theme:
   1) Copy this file and rename to your-theme.ts
   2) Replace "yourTheme" with your theme's camelCase name
   3) Edit the metadata values
   4) Add the import and entry to index.ts:
      - import { yourTheme } from "./your-theme";
      - Add yourTheme to the THEMES array */

import type { ThemeDefinition } from "./types";

export const yourTheme = {
  id: "your-theme",
  name: "Your Theme",
  description: "Short description of your theme's aesthetic",
  colorScheme: "dark", // or "light"
  preview: {
    bg: "#1a1a2e",      // Approximate hex of --background
    sidebar: "#151527",  // Approximate hex of --sidebar
    primary: "#8b5cf6",  // Approximate hex of --primary
  },
} as const satisfies ThemeDefinition;
