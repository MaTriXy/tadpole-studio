"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Library,
  History,
  ListMusic,
  Cpu,
  GraduationCap,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Radio,
  MessageCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useActiveBackend } from "@/hooks/use-active-backend";
import { useSidebarStore } from "@/stores/sidebar-store";
import { usePlayerStore } from "@/stores/player-store";
import { SidebarQueue } from "@/components/layout/sidebar-queue";
import { TadpoleIcon } from "@/components/icons/tadpole-icon";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/create", label: "Create", icon: Sparkles },
  { href: "/radio", label: "Radio", icon: Radio },
  { href: "/dj", label: "AI DJ", icon: MessageCircle },
  { href: "/library", label: "Library", icon: Library },
  { href: "/history", label: "History", icon: History },
  { href: "/playlists", label: "Playlists", icon: ListMusic },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const HEARTMULA_DISABLED_ITEMS = new Set(["/dj", "/radio"]);

function NavItems({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { activeBackend } = useActiveBackend();

  return (
    <nav className="space-y-1 px-2 py-4">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const disabled =
          activeBackend === "heartmula" && HEARTMULA_DISABLED_ITEMS.has(item.href);

        if (disabled) {
          const disabledItem = (
            <span
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium opacity-40 pointer-events-none",
                collapsed && "justify-center px-0",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </span>
          );

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <div className="pointer-events-auto">{disabledItem}</div>
              </TooltipTrigger>
              <TooltipContent side="right">
                Not supported by HeartMuLa backend
              </TooltipContent>
            </Tooltip>
          );
        }

        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }
        return link;
      })}
    </nav>
  );
}

export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const hasPlayer = !!usePlayerStore((s) => s.currentSong);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-250 md:flex",
          collapsed ? "w-16" : "w-60",
          hasPlayer && "pb-[72px]",
        )}
      >
        <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
          <TadpoleIcon className="h-8 w-auto shrink-0 text-primary" />
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Tadpole Studio
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <NavItems collapsed={collapsed} />
          <SidebarQueue collapsed={collapsed} />
        </div>

        <div className="border-t border-sidebar-border p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground"
              >
                {collapsed ? (
                  <PanelLeft className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar md:hidden"
            >
              <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
                <TadpoleIcon className="h-8 w-auto shrink-0 text-primary" />
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  Tadpole Studio
                </span>
              </div>

              <div className="flex flex-1 flex-col overflow-y-auto">
                <NavItems
                  collapsed={false}
                  onNavigate={() => setMobileOpen(false)}
                />
                <SidebarQueue collapsed={false} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
