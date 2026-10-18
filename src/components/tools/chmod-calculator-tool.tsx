"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SafetyNote } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { parseOctal, parseSymbolic, toOctal, toSymbolic, type ChmodError } from "@/lib/chmod";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";

const CLASSES = ["owner", "group", "others"] as const;
const PERMISSIONS = ["read", "write", "execute"] as const;
const PRESETS = ["644", "755", "600", "700", "777", "000"];

export function ChmodCalculatorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.chmodCalculator;

  const [bits, setBits] = React.useState(0o644);
  // 入力途中の値や不正な値はそのまま残し、正しい値になったときだけ反映する
  const [octalDraft, setOctalDraft] = React.useState(toOctal(0o644));
  const [symbolicDraft, setSymbolicDraft] = React.useState(toSymbolic(0o644));
  const [octalError, setOctalError] = React.useState<ChmodError | null>(null);
  const [symbolicError, setSymbolicError] = React.useState<ChmodError | null>(null);

  function apply(next: number) {
    setBits(next);
    setOctalDraft(toOctal(next));
    setSymbolicDraft(toSymbolic(next));
    setOctalError(null);
    setSymbolicError(null);
  }

  function onDraft(
    value: string,
    parse: typeof parseOctal,
    setDraft: (value: string) => void,
    setError: (error: ChmodError | null) => void,
    syncOther: (bits: number) => void
  ) {
    setDraft(value);
    const result = parse(value);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setBits(result.bits);
    syncOther(result.bits);
  }

  const octal = toOctal(bits);

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>
      <p className="text-sm text-muted-foreground">{dict.scopeNote}</p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium" />
              {PERMISSIONS.map((permission) => (
                <th key={permission} className="px-3 py-2 text-center font-medium">
                  {dict.permissions[permission]}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium">{dict.digit}</th>
            </tr>
          </thead>
          <tbody>
            {CLASSES.map((cls, row) => (
              <tr key={cls} className="border-t">
                <th scope="row" className="px-3 py-2 font-medium">
                  {dict.classes[cls]}
                </th>
                {PERMISSIONS.map((permission, column) => {
                  const bit = 1 << (8 - (row * 3 + column));
                  return (
                    <td key={permission} className="px-3 py-2 text-center">
                      <Checkbox
                        checked={(bits & bit) !== 0}
                        onCheckedChange={(checked) => apply(checked === true ? bits | bit : bits & ~bit)}
                        aria-label={`${dict.classes[cls]} ${dict.permissions[permission]}`}
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-mono">{octal[row]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="chmod-octal" className="text-sm font-medium">
            {dict.octalLabel}
          </label>
          <Input
            id="chmod-octal"
            value={octalDraft}
            onChange={(e) => onDraft(e.target.value, parseOctal, setOctalDraft, setOctalError, (next) => setSymbolicDraft(toSymbolic(next)))}
            inputMode="numeric"
            spellCheck={false}
            aria-invalid={!!octalError || undefined}
            className="font-mono"
          />
          {octalError && <p className="text-sm text-destructive">{dict.errors[octalError]}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="chmod-symbolic" className="text-sm font-medium">
            {dict.symbolicLabel}
          </label>
          <Input
            id="chmod-symbolic"
            value={symbolicDraft}
            onChange={(e) => onDraft(e.target.value, parseSymbolic, setSymbolicDraft, setSymbolicError, (next) => setOctalDraft(toOctal(next)))}
            spellCheck={false}
            aria-invalid={!!symbolicError || undefined}
            className="font-mono"
          />
          {symbolicError && <p className="text-sm text-destructive">{dict.errors[symbolicError]}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{dict.presets}</span>
        {PRESETS.map((preset) => (
          <Button key={preset} type="button" variant="outline" size="sm" className="font-mono" onClick={() => apply(parseInt(preset, 8))}>
            {preset}
          </Button>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">{dict.resultHeading}</h2>
          <ToolActions getCopyText={() => `chmod ${octal}`} />
        </div>
        <pre className="rounded-lg border bg-muted/40 p-3 font-mono text-sm">
          chmod {octal} <span className="text-muted-foreground">{dict.fileName}</span>
          {"\n"}
          {toSymbolic(bits)}
        </pre>
        <ul className="flex flex-col gap-1 text-sm">
          {CLASSES.map((cls, row) => {
            const granted = PERMISSIONS.filter((_, column) => bits & (1 << (8 - (row * 3 + column))));
            return (
              <li key={cls}>
                <span className="font-medium">{dict.classes[cls]}: </span>
                {granted.length === 0 ? dict.none : granted.map((p) => dict.permissions[p]).join(dict.separator)}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="font-medium">{dict.meaningHeading}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-left">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium" />
                <th className="px-3 py-2 font-medium">{dict.forFile}</th>
                <th className="px-3 py-2 font-medium">{dict.forDirectory}</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((permission) => (
                <tr key={permission} className="border-t align-top">
                  <th scope="row" className="whitespace-nowrap px-3 py-2 font-medium">
                    {dict.permissions[permission]}
                  </th>
                  <td className="px-3 py-2">{dict.fileMeaning[permission]}</td>
                  <td className="px-3 py-2">{dict.directoryMeaning[permission]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
