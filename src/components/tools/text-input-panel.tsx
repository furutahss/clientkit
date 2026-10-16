"use client";

import * as React from "react";
import { FileUp, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function SafetyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** ファイル読み込み（ボタン・ドラッグ＆ドロップ）付きのテキスト入力欄 */
export function TextInputPanel({
  id,
  label,
  value,
  onChange,
  placeholder,
  openFileLabel,
  onFileError,
  accept,
  invalid,
  className,
  onPaste,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  openFileLabel: string;
  onFileError: () => void;
  accept?: string;
  invalid?: boolean;
  className?: string;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  function loadFile(file: File) {
    file.text().then(onChange).catch(onFileError);
  }

  return (
    <div
      className="flex flex-col gap-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        e.preventDefault();
        loadFile(file);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
          <FileUp className="size-4" />
          {openFileLabel}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) loadFile(file);
            e.target.value = "";
          }}
        />
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        placeholder={placeholder}
        spellCheck={false}
        aria-invalid={invalid || undefined}
        className={cn("min-h-56 font-mono text-sm", className)}
      />
    </div>
  );
}
