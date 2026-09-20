"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";

export function MobileSidebar() {
  const [open, setOpen] = React.useState(false);
  const locale = useLocale();
  const dict = getDictionary(locale);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={dict.header.menuAriaLabel}
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{dict.sidebar.mobileTitle}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
