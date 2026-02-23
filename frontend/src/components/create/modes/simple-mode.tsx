"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerationStore } from "@/stores/generation-store";
import { VALID_LANGUAGES } from "@/lib/constants";

export function SimpleMode() {
  const form = useGenerationStore((s) => s.simpleForm);
  const update = useGenerationStore((s) => s.updateSimpleForm);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="simple-prompt">Describe your music</Label>
        <Textarea
          id="simple-prompt"
          value={form.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder="A dreamy lo-fi beat with soft piano and gentle rain sounds..."
          className="min-h-[120px] resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={form.language} onValueChange={(v) => update({ language: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VALID_LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2 pb-1">
          <Switch
            id="simple-instrumental"
            checked={form.instrumental}
            onCheckedChange={(v) => update({ instrumental: v })}
          />
          <Label htmlFor="simple-instrumental" className="cursor-pointer">
            Instrumental
          </Label>
        </div>
      </div>
    </div>
  );
}
