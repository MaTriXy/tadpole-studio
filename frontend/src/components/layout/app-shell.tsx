"use client";

import { type ReactNode, useEffect } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";
import { usePlayerStore } from "@/stores/player-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useMediaSession } from "@/hooks/use-media-session";
import { getSongAudioUrl } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { useRadioPlayback } from "@/hooks/use-radio-playback";
import { useGenerationWs } from "@/hooks/use-generation-ws";
import { useTrainingWs } from "@/hooks/use-training-ws";
import { Sidebar } from "./sidebar";
import { MiniPlayer } from "./mini-player";
import { MiniPlayerQueue } from "./mini-player-queue";
import { FullPlayer } from "./full-player";
import { ConnectionBanner } from "./connection-banner";
import { PageTransition } from "./page-transition";

export function AppShell({ children }: { children: ReactNode }) {
  useKeyboardShortcuts();
  useMediaSession();
  useRadioPlayback();
  useGenerationWs();
  useTrainingWs();

  // Rehydrate audioUrl from persisted currentSong on page load
  useEffect(() => {
    const { currentSong, audioUrl } = usePlayerStore.getState();
    if (currentSong && !audioUrl) {
      usePlayerStore.setState({
        audioUrl: getSongAudioUrl(currentSong.id),
        isPlaying: false,
      });
    }
  }, []);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleMobile = useSidebarStore((s) => s.toggleMobile);
  const currentSong = usePlayerStore((s) => s.currentSong);

  return (
    <div className="min-h-screen">
      <Sidebar />

      {/* Mobile header */}
      <div className="fixed left-0 right-0 top-0 z-20 flex h-12 items-center border-b bg-background px-3 md:hidden">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMobile}>
          <Menu className="h-5 w-5" />
        </Button>
        <span className="ml-2 text-sm font-semibold">Tadpole Studio</span>
      </div>

      <div
        className={cn(
          "flex min-h-screen flex-col transition-all duration-250 mt-12 md:mt-0",
          collapsed ? "md:ml-16" : "md:ml-60",
          currentSong && "pb-[72px]",
        )}
      >
        <ConnectionBanner />
        <main className="flex-1 bg-background p-3 sm:p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <MiniPlayer />
      <MiniPlayerQueue />
      <FullPlayer />
    </div>
  );
}
