"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordRecentTool } from "@/lib/tool-preferences";

export function ToolHistoryTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const match = pathname.match(/^\/(?:ja|en)\/tools\/([^/]+)\/?$/);
    if (match) recordRecentTool(match[1]);
  }, [pathname]);
  return null;
}
