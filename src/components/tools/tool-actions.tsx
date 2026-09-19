"use client";

import * as React from "react";
import { Check, Copy, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ToolActions({
  onClear,
  getCopyText,
  copyDisabled,
  clearDisabled,
}: {
  onClear?: () => void;
  getCopyText?: () => string;
  copyDisabled?: boolean;
  clearDisabled?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    if (!getCopyText) return;
    const text = getCopyText();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードAPIが利用できない環境では何もしない
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {getCopyText && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={copyDisabled}
        >
          {copied ? (
            <Check className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}
          {copied ? "コピーしました" : "クリップボードへコピー"}
        </Button>
      )}
      {onClear && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={clearDisabled}
        >
          <Trash2 className="size-4" />
          クリア
        </Button>
      )}
    </div>
  );
}
