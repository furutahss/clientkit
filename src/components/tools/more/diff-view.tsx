import type { FileDiff } from "@/lib/more/unified-diff";
import { toSideBySide } from "@/lib/more/unified-diff";

const cell = (type: " " | "+" | "-" | undefined) => (type === "+" ? "bg-emerald-500/15" : type === "-" ? "bg-red-500/15" : "");

/** unified diff を左右に並べて表示する（追加は緑、削除は赤） */
export function DiffView({ files, sideBySide }: { files: FileDiff[]; sideBySide: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      {files.map((f, fi) => (
        <section key={fi} className="flex flex-col gap-2">
          <h3 className="flex flex-wrap items-baseline gap-2 text-sm font-semibold">
            <span className="font-mono break-all">{f.oldName === f.newName ? f.newName : `${f.oldName} → ${f.newName}`}</span>
            <span className="text-xs font-normal text-muted-foreground">{f.status}</span>
            <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">+{f.added}</span>
            <span className="text-xs font-normal text-red-600 dark:text-red-400">−{f.removed}</span>
          </h3>
          {f.hunks.map((h, hi) => (
            <div key={hi} className="overflow-x-auto rounded-md border font-mono text-xs">
              <div className="bg-muted/50 px-3 py-1 text-muted-foreground">{h.header}</div>
              <table className="w-full border-collapse">
                <tbody>
                  {sideBySide
                    ? toSideBySide(h.lines).map((r, ri) => (
                        <tr key={ri} className="align-top">
                          <td className={`w-10 px-2 text-right text-muted-foreground select-none ${cell(r.left?.type)}`}>{r.left?.oldNo ?? ""}</td>
                          <td className={`w-1/2 px-2 whitespace-pre-wrap break-all ${cell(r.left?.type)}`}>{r.left?.text ?? ""}</td>
                          <td className={`w-10 border-l px-2 text-right text-muted-foreground select-none ${cell(r.right?.type)}`}>{r.right?.newNo ?? ""}</td>
                          <td className={`w-1/2 px-2 whitespace-pre-wrap break-all ${cell(r.right?.type)}`}>{r.right?.text ?? ""}</td>
                        </tr>
                      ))
                    : h.lines.map((l, li) => (
                        <tr key={li} className={`align-top ${cell(l.type)}`}>
                          <td className="w-10 px-2 text-right text-muted-foreground select-none">{l.oldNo ?? ""}</td>
                          <td className="w-10 px-2 text-right text-muted-foreground select-none">{l.newNo ?? ""}</td>
                          <td className="px-2 whitespace-pre-wrap break-all">{l.type === " " ? " " : l.type}{l.text}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
