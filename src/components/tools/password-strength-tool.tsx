"use client";

import * as React from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";

import { SafetyNote } from "@/components/tools/text-input-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { checkPasswordStrength } from "@/lib/password-strength";

export function PasswordStrengthTool() {
  const dict = getDictionary(useLocale()).tools.passwordStrength;
  const [password, setPassword] = React.useState("");
  const [visible, setVisible] = React.useState(false);
  const result = checkPasswordStrength(password);
  const labels = [dict.empty, dict.weak, dict.fair, dict.good, dict.strong];

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>
      <div className="flex flex-col gap-2">
        <label htmlFor="strength-password" className="text-sm font-medium">{dict.passwordLabel}</label>
        <div className="flex gap-2">
          <Input
            id="strength-password"
            type={visible ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={1024}
            aria-describedby="strength-limit strength-disclaimer"
            className="font-mono"
          />
          <Button type="button" variant="outline" size="icon" aria-label={visible ? dict.hide : dict.show} aria-pressed={visible} onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Button type="button" variant="outline" disabled={!password} onClick={() => { setPassword(""); setVisible(false); }}>
            <RotateCcw className="size-4" />{dict.clear}
          </Button>
        </div>
        <p id="strength-limit" className="text-xs text-muted-foreground">{dict.limit}</p>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border p-4" role="status" aria-live="polite" aria-atomic="true">
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium">{dict.strength}: {labels[result.score]}</span>
          <span>{dict.length}: {result.length}</span>
        </div>
        <div role="meter" aria-label={dict.strength} aria-valuemin={0} aria-valuemax={4} aria-valuenow={result.score} aria-valuetext={labels[result.score]} className="flex gap-1">
          {[1, 2, 3, 4].map((step) => <div key={step} className={`h-2 flex-1 rounded-full ${step <= result.score ? ["", "bg-destructive", "bg-amber-500", "bg-blue-500", "bg-emerald-500"][result.score] : "bg-muted"}`} />)}
        </div>
        {result.issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {result.issues.map((issue) => <li key={issue}>{dict.issues[issue]}</li>)}
        </ul>}
      </div>
      <p id="strength-disclaimer" className="text-sm text-muted-foreground">{dict.disclaimer}</p>
    </div>
  );
}
