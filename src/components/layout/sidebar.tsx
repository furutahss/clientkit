import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function Sidebar() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r md:block">
      <ScrollArea className="h-full">
        <SidebarNav />
      </ScrollArea>
    </aside>
  );
}
