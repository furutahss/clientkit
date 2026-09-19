import { Breadcrumb } from "@/components/layout/breadcrumb";
import { getCategoryById, type Tool } from "@/config/tools";

export function ToolPageHeader({ tool }: { tool: Tool }) {
  const category = getCategoryById(tool.category);

  return (
    <div className="flex flex-col gap-2">
      <Breadcrumb
        items={[
          ...(category ? [{ label: category.label }] : []),
          { label: tool.name },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight">{tool.name}</h1>
      <p className="text-muted-foreground">
        {tool.longDescription ?? tool.description}
      </p>
    </div>
  );
}
