export type { ThemeDefinition } from "./types";
import { midnight } from "./midnight";
import { ocean } from "./ocean";
import { ember } from "./ember";
import { neon } from "./neon";
import { sakura } from "./sakura";
import { retro } from "./retro";
import { cafe } from "./cafe";
import { slate } from "./slate";
import { vapor } from "./vapor";
import { sunset } from "./sunset";
import { daylight } from "./daylight";

export const THEMES = [midnight, ocean, ember, neon, sakura, retro, cafe, slate, vapor, sunset, daylight] as const;
export type BuiltInThemeId = (typeof THEMES)[number]["id"];
export type ThemeId = BuiltInThemeId | (string & {});
export const THEME_IDS = THEMES.map(t => t.id);
export const DEFAULT_THEME: ThemeId = "midnight";
