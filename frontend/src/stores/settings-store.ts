import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type ThemeId, DEFAULT_THEME } from "@/themes";
import { updateSettings } from "@/lib/api/client";

interface SettingsState {
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  radioAutoSave: boolean;
  setRadioAutoSave: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      backendUrl: "http://localhost:8000",
      setBackendUrl: (url) => {
        set({ backendUrl: url });
        localStorage.setItem("tadpole-studio-backend-url", url);
      },
      theme: DEFAULT_THEME,
      setTheme: (theme) => {
        set({ theme });
        // Fire-and-forget sync to backend for cross-browser persistence
        updateSettings({ theme }).catch(() => {});
      },
      radioAutoSave: false,
      setRadioAutoSave: (enabled) => set({ radioAutoSave: enabled }),
    }),
    { name: "tadpole-studio-settings" },
  ),
);
