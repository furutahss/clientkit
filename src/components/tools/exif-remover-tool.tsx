"use client";

import * as React from "react";
import {
  ChevronDown,
  Download,
  ImageUp,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ToolActions } from "@/components/tools/tool-actions";
import { createZip, downloadBytes } from "@/lib/download";
import { formatBytes } from "@/lib/format-bytes";
import {
  hasAnyMetadata,
  readImageMetadata,
  stripImageMetadata,
  type MetadataGroup,
  type MetadataReport,
} from "@/lib/image-metadata";
import { getDictionary } from "@/i18n/dictionaries";
import type { Dictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type Dict = Dictionary["tools"]["exifRemover"];

type ImageItem = {
  id: string;
  file: File;
  bytes: Uint8Array;
  objectUrl: string;
  report: MetadataReport | null;
  error: string | null;
};

const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

const GROUP_ORDER: MetadataGroup[] = ["gps", "image", "exif", "interop", "thumbnail"];

const MIME_BY_FORMAT = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

function cleanFileName(name: string): string {
  const index = name.lastIndexOf(".");
  return index > 0
    ? `${name.slice(0, index)}_clean${name.slice(index)}`
    : `${name}_clean`;
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function MetadataBadges({ report, dict }: { report: MetadataReport; dict: Dict }) {
  const badges: { label: string; danger?: boolean }[] = [];
  if (report.gps) badges.push({ label: dict.badgeGps, danger: true });
  if (report.hasExif) badges.push({ label: dict.badgeExif });
  if (report.hasXmp) badges.push({ label: dict.badgeXmp });
  if (report.hasIptc) badges.push({ label: dict.badgeIptc });
  if (report.hasComment) badges.push({ label: dict.badgeComment });
  if (report.hasTextChunks) badges.push({ label: dict.badgeText });

  if (badges.length === 0) {
    return (
      <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
        {dict.badgeNone}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={cn(
            "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium",
            badge.danger
              ? "bg-destructive/10 text-destructive"
              : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
          )}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function ImageCard({
  item,
  dict,
  onRemove,
  onDownload,
}: {
  item: ImageItem;
  dict: Dict;
  onRemove: () => void;
  onDownload: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const report = item.report;

  const groups = React.useMemo(() => {
    if (!report) return [];
    return GROUP_ORDER.map((group) => ({
      group,
      entries: report.entries.filter((entry) => entry.group === group),
    })).filter((section) => section.entries.length > 0);
  }, [report]);

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-[repeating-conic-gradient(#0000000d_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]">
          {item.error ? (
            <ImageUp className="size-6 text-muted-foreground" aria-hidden="true" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- ローカルのobject URLをそのまま表示するため
            <img src={item.objectUrl} alt={item.file.name} className="max-h-full max-w-full object-contain" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{item.file.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={onRemove}
              aria-label={formatTemplate(dict.removeFile, { name: item.file.name })}
            >
              <X className="size-4" />
            </Button>
          </div>
          {item.error ? (
            <p className="text-sm text-destructive">{item.error}</p>
          ) : (
            report && <MetadataBadges report={report} dict={dict} />
          )}
        </div>
      </div>

      {report?.gps && (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {dict.gpsWarning}
          </div>
          <div className="font-mono text-xs">
            {formatTemplate(dict.gpsCoordinates, {
              lat: formatCoordinate(report.gps.latitude),
              lng: formatCoordinate(report.gps.longitude),
            })}
            {report.gps.altitude !== undefined &&
              ` ・ ${formatTemplate(dict.gpsAltitude, { alt: Math.round(report.gps.altitude * 10) / 10 })}`}
          </div>
          <ToolActions
            getCopyText={() =>
              `${formatCoordinate(report.gps!.latitude)}, ${formatCoordinate(report.gps!.longitude)}`
            }
          />
        </div>
      )}

      {report && !item.error && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={onDownload}>
            <Download className="size-4" />
            {dict.downloadOne}
          </Button>
          {report.entries.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
            >
              <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
              {formatTemplate(expanded ? dict.hideDetails : dict.showDetails, {
                count: report.entries.length,
              })}
            </Button>
          )}
          {report.orientation && report.orientation !== 1 && (
            <span className="text-xs text-muted-foreground">
              {formatTemplate(dict.orientationValue, { value: report.orientation })}
            </span>
          )}
        </div>
      )}

      {expanded && report && (
        <div className="flex flex-col gap-3">
          {groups.map((section) => (
            <div key={section.group} className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">
                {dict.groups[section.group]}
              </span>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {section.entries.map((entry, index) => (
                      <tr key={`${entry.tag}-${index}`} className="border-b last:border-b-0">
                        <th scope="row" className="w-48 bg-muted/40 px-2 py-1.5 font-medium">
                          {entry.tag}
                        </th>
                        <td className="break-all px-2 py-1.5 font-mono">{entry.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

export function ExifRemoverTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.exifRemover, [locale]);

  const [items, setItems] = React.useState<ImageItem[]>([]);
  const [keepOrientation, setKeepOrientation] = React.useState(true);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isZipping, setIsZipping] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const nextIdRef = React.useRef(0);
  const itemsRef = React.useRef<ImageItem[]>([]);

  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    return () => {
      for (const item of itemsRef.current) URL.revokeObjectURL(item.objectUrl);
    };
  }, []);

  const handleFiles = React.useCallback(
    async (files: File[]) => {
      setIsLoading(true);
      setActionError(null);
      const loaded: ImageItem[] = [];
      for (const file of files) {
        let bytes: Uint8Array;
        try {
          bytes = new Uint8Array(await file.arrayBuffer());
        } catch {
          continue;
        }
        let report: MetadataReport | null = null;
        let error: string | null = null;
        try {
          report = readImageMetadata(bytes);
        } catch {
          error = dict.unsupportedFormat;
        }
        loaded.push({
          id: `img${nextIdRef.current++}`,
          file,
          bytes,
          objectUrl: URL.createObjectURL(file),
          report,
          error,
        });
      }
      setItems((prev) => [...prev, ...loaded]);
      setIsLoading(false);
    },
    [dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("exif-remover");
    if (!pending) return;
    const timer = window.setTimeout(() => {
      void handleFiles([pending]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [handleFiles]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) void handleFiles(files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) void handleFiles(files);
  }

  function handleRemove(id: string) {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  function handleReset() {
    for (const item of items) URL.revokeObjectURL(item.objectUrl);
    setItems([]);
    setActionError(null);
  }

  function stripItem(item: ImageItem): Uint8Array {
    return stripImageMetadata(item.bytes, { keepOrientation });
  }

  function handleDownloadOne(item: ImageItem) {
    if (!item.report) return;
    try {
      downloadBytes(
        stripItem(item),
        cleanFileName(item.file.name),
        MIME_BY_FORMAT[item.report.format]
      );
      setActionError(null);
    } catch {
      setActionError(formatTemplate(dict.stripError, { name: item.file.name }));
    }
  }

  const processable = items.filter((item) => item.report && !item.error);

  async function handleDownloadAll() {
    if (processable.length === 0) return;
    if (processable.length === 1) {
      handleDownloadOne(processable[0]);
      return;
    }
    setIsZipping(true);
    setActionError(null);
    try {
      const entries = processable.map((item) => ({
        name: cleanFileName(item.file.name),
        data: stripItem(item),
      }));
      const zip = await createZip(entries);
      downloadBytes(zip, "images_clean.zip", "application/zip");
    } catch {
      setActionError(dict.zipError);
    } finally {
      setIsZipping(false);
    }
  }

  const gpsCount = processable.filter((item) => item.report?.gps).length;
  const metadataCount = processable.filter(
    (item) => item.report && hasAnyMetadata(item.report)
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      {items.length === 0 ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-accent/30"
          )}
        >
          <ImageUp className="size-10 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">{isLoading ? dict.loading : dict.dropLabel}</p>
            <p className="text-sm text-muted-foreground">{dict.dropHint}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {formatTemplate(dict.summary, {
                  count: items.length,
                  withMetadata: metadataCount,
                  withGps: gpsCount,
                })}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Plus className="size-4" />
                  {dict.addFiles}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                  <RefreshCw className="size-4" />
                  {dict.startOver}
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="exif-keep-orientation"
                checked={keepOrientation}
                onCheckedChange={(checked) => setKeepOrientation(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="exif-keep-orientation" className="flex flex-col gap-0.5 text-sm">
                <span>{dict.keepOrientation}</span>
                <span className="text-xs text-muted-foreground">{dict.keepOrientationHint}</span>
              </label>
            </div>
            <Button
              type="button"
              className="w-fit"
              onClick={() => void handleDownloadAll()}
              disabled={processable.length === 0 || isZipping}
            >
              <Download className="size-4" />
              {processable.length > 1
                ? formatTemplate(dict.downloadAllZip, { count: processable.length })
                : dict.downloadOne}
            </Button>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          </div>

          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <ImageCard
                key={item.id}
                item={item}
                dict={dict}
                onRemove={() => handleRemove(item.id)}
                onDownload={() => handleDownloadOne(item)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
