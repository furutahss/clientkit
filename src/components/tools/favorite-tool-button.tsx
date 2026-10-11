"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { toggleFavorite, useToolPreferences } from "@/lib/tool-preferences";
import { cn, formatTemplate } from "@/lib/utils";

export function FavoriteToolButton({
  id,
  name,
  lang,
}: {
  id: string;
  name: string;
  lang: Locale;
}) {
  const { favorites } = useToolPreferences();
  const selected = favorites.includes(id);
  const dict = getDictionary(lang).discovery;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10 shrink-0"
      onClick={() => toggleFavorite(id)}
      aria-pressed={selected}
      aria-label={formatTemplate(
        selected ? dict.removeFavorite : dict.addFavorite,
        { name },
      )}
    >
      <Star
        className={cn("size-4", selected && "fill-current")}
        aria-hidden="true"
      />
    </Button>
  );
}
