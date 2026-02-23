"use client";

import type { LucideIcon } from "lucide-react";
import {
  ListMusic,
  Music,
  Music2,
  Music4,
  Headphones,
  Mic,
  Mic2,
  Radio,
  Disc3,
  Guitar,
  Piano,
  Drum,
  Heart,
  Star,
  Zap,
  Flame,
  Cloud,
  Moon,
  Sun,
  Sparkles,
  PartyPopper,
  Waves,
  TreePalm,
  AudioLines,
  // Animals
  Bird,
  Bone,
  Bug,
  Cat,
  Dog,
  Fish,
  FishSymbol,
  Origami,
  PawPrint,
  Rabbit,
  Rat,
  Shell,
  Shrimp,
  Snail,
  Squirrel,
  Turtle,
  // Expressions & people
  Eye,
  Angry,
  Annoyed,
  Frown,
  Laugh,
  Meh,
  Smile,
  Baby,
  Skull,
  // Hands & body
  BicepsFlexed,
  HandMetal,
  HandHelping,
  // Hearts & misc
  HeartCrack,
  HeartHandshake,
  Clover,
  LeafyGreen,
  Atom,
  Snowflake,
  CandyCane,
  Balloon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const PLAYLIST_ICONS: ReadonlyArray<{ name: string; icon: LucideIcon }> = [
  // Music
  { name: "ListMusic", icon: ListMusic },
  { name: "Music", icon: Music },
  { name: "Music2", icon: Music2 },
  { name: "Music4", icon: Music4 },
  { name: "Headphones", icon: Headphones },
  { name: "Mic", icon: Mic },
  { name: "Mic2", icon: Mic2 },
  { name: "Radio", icon: Radio },
  { name: "Disc3", icon: Disc3 },
  { name: "Guitar", icon: Guitar },
  { name: "Piano", icon: Piano },
  { name: "Drum", icon: Drum },
  { name: "AudioLines", icon: AudioLines },
  // Animals
  { name: "Bird", icon: Bird },
  { name: "Bone", icon: Bone },
  { name: "Bug", icon: Bug },
  { name: "Cat", icon: Cat },
  { name: "Dog", icon: Dog },
  { name: "Fish", icon: Fish },
  { name: "FishSymbol", icon: FishSymbol },
  { name: "Origami", icon: Origami },
  { name: "PawPrint", icon: PawPrint },
  { name: "Rabbit", icon: Rabbit },
  { name: "Rat", icon: Rat },
  { name: "Shell", icon: Shell },
  { name: "Shrimp", icon: Shrimp },
  { name: "Snail", icon: Snail },
  { name: "Squirrel", icon: Squirrel },
  { name: "Turtle", icon: Turtle },
  // Expressions & people
  { name: "Eye", icon: Eye },
  { name: "Angry", icon: Angry },
  { name: "Annoyed", icon: Annoyed },
  { name: "Frown", icon: Frown },
  { name: "Laugh", icon: Laugh },
  { name: "Meh", icon: Meh },
  { name: "Smile", icon: Smile },
  { name: "Baby", icon: Baby },
  { name: "Skull", icon: Skull },
  // Hands & body
  { name: "BicepsFlexed", icon: BicepsFlexed },
  { name: "HandMetal", icon: HandMetal },
  { name: "HandHelping", icon: HandHelping },
  // Hearts & mood
  { name: "Heart", icon: Heart },
  { name: "HeartCrack", icon: HeartCrack },
  { name: "HeartHandshake", icon: HeartHandshake },
  { name: "Star", icon: Star },
  { name: "Zap", icon: Zap },
  { name: "Flame", icon: Flame },
  { name: "Sparkles", icon: Sparkles },
  { name: "PartyPopper", icon: PartyPopper },
  { name: "Balloon", icon: Balloon },
  // Nature & weather
  { name: "Cloud", icon: Cloud },
  { name: "Moon", icon: Moon },
  { name: "Sun", icon: Sun },
  { name: "Snowflake", icon: Snowflake },
  { name: "Waves", icon: Waves },
  { name: "TreePalm", icon: TreePalm },
  { name: "Clover", icon: Clover },
  { name: "LeafyGreen", icon: LeafyGreen },
  // Misc
  { name: "Atom", icon: Atom },
  { name: "CandyCane", icon: CandyCane },
] as const;

const iconMap = new Map(PLAYLIST_ICONS.map((entry) => [entry.name, entry.icon]));

export function getPlaylistIcon(name: string): LucideIcon {
  return iconMap.get(name) ?? ListMusic;
}

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const CurrentIcon = getPlaylistIcon(value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20"
          onClick={(e) => e.stopPropagation()}
        >
          <CurrentIcon className="h-7 w-7 text-primary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[296px] p-2"
        align="center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-8 gap-1">
          {PLAYLIST_ICONS.map(({ name, icon: Icon }) => (
            <Button
              key={name}
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                value === name && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onChange(name);
              }}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
