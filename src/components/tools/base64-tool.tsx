"use client";

import * as React from "react";
import { ArrowDownUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { cn } from "@/lib/utils";

type Mode = "encode" | "decode";

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function Base64Tool() {
  const [mode, setMode] = React.useState<Mode>("encode");
  const [input, setInput] = React.useState("");

  const { output, error } = React.useMemo(() => {
    if (!input) return { output: "", error: null as string | null };

    try {
      const result =
        mode === "encode" ? encodeBase64(input) : decodeBase64(input);
      return { output: result, error: null };
    } catch {
      return {
        output: "",
        error:
          mode === "encode"
            ? "エンコードに失敗しました。"
            : "デコードに失敗しました。有効なBase64文字列を入力してください。",
      };
    }
  }, [input, mode]);

  function handleSwap() {
    setMode((prev) => (prev === "encode" ? "decode" : "encode"));
    setInput(output);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit rounded-md border p-1">
        {(["encode", "decode"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "encode" ? "エンコード" : "デコード"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          {mode === "encode" ? "入力テキスト" : "Base64文字列"}
        </label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === "encode"
              ? "エンコードするテキストを入力..."
              : "デコードするBase64文字列を入力..."
          }
          className="min-h-32 font-mono text-sm"
        />
      </div>

      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSwap}
          disabled={!output}
        >
          <ArrowDownUp className="size-4" />
          結果を入力欄に反映して切り替え
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          {mode === "encode" ? "Base64文字列" : "デコード結果"}
        </label>
        <Textarea
          value={output}
          readOnly
          placeholder="結果がここに表示されます"
          className="min-h-32 font-mono text-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <ToolActions
        onClear={() => setInput("")}
        clearDisabled={!input}
        getCopyText={() => output}
        copyDisabled={!output}
      />
    </div>
  );
}
