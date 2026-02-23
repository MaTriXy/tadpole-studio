// AI DJ chat feature -- inspired by clockworksquirrel/ace-step-apple-silicon
// (conversational AI DJ interface)
"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Settings, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDJ } from "@/hooks/use-dj";
import { fetchAvailableModels } from "@/lib/api/client";
import { ConversationList } from "./conversation-list";
import { ChatPanel } from "./chat-panel";
import { DJSettingsDialog } from "./dj-settings-dialog";

export function DJClient() {
  const { loadConversations } = useDJ();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: available } = useQuery({
    queryKey: ["available-models"],
    queryFn: fetchAvailableModels,
    refetchInterval: 30_000,
  });

  const hasChatLlm = available?.models.some(
    (m) => m.model_type === "chat_llm" && m.installed,
  ) ?? false;

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">AI DJ</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <Separator className="my-4" />

      {/* Missing chat LLM warning */}
      {!hasChatLlm && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No Chat LLM installed. The AI DJ requires a small language model to
            work.{" "}
            <Link href="/models" className="font-medium underline hover:no-underline">
              Download one from the Models tab
            </Link>
            .
          </span>
        </div>
      )}

      {/* Main layout: sidebar + chat */}
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-lg border border-border">
        {/* Sidebar -- hidden on mobile */}
        <aside className="hidden w-72 shrink-0 overflow-x-hidden overflow-y-auto border-r border-border md:block">
          <ConversationList />
        </aside>

        {/* Chat area */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ChatPanel hasChatLlm={hasChatLlm} />
        </main>
      </div>

      {/* Settings dialog */}
      <DJSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
