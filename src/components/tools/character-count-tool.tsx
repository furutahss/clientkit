"use client";

import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";

function countStats(text: string) {
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split("\n").length : 0;
  const bytes = new TextEncoder().encode(text).length;

  return { characters, charactersNoSpaces, words, lines, bytes };
}

export function CharacterCountTool() {
  const [text, setText] = React.useState("");
  const stats = React.useMemo(() => countStats(text), [text]);

  const statItems = [
    { label: "文字数", value: stats.characters },
    { label: "文字数（空白除く）", value: stats.charactersNoSpaces },
    { label: "単語数", value: stats.words },
    { label: "行数", value: stats.lines },
    { label: "バイト数（UTF-8）", value: stats.bytes },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="ここにテキストを入力してください..."
        className="min-h-48 font-mono text-sm"
        aria-label="カウント対象のテキスト"
      />

      <ToolActions
        onClear={() => setText("")}
        clearDisabled={!text}
        getCopyText={() => text}
        copyDisabled={!text}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statItems.map((item) => (
          <Card key={item.label}>
            <CardContent className="flex flex-col gap-1 px-4">
              <span className="text-xs text-muted-foreground">
                {item.label}
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {item.value.toLocaleString()}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
