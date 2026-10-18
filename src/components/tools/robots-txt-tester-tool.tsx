"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { checkUrls, isProductToken, parseRobots, type RobotsNote } from "@/lib/robots";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

const SAMPLE_ROBOTS = `User-agent: *
Disallow: /admin/
Allow: /admin/help/
Disallow: /*.pdf$
Disallow: /search
Crawl-delay: 10

User-agent: Googlebot
Disallow: /tmp/
Allow: /tmp/

Sitemap: https://example.com/sitemap.xml`;

const SAMPLE_URLS = `https://example.com/
/admin/settings
/admin/help/faq
/files/manual.pdf
/files/manual.pdf?download=1
/search?q=robots
/tmp/cache
/robots.txt`;

type Dict = ReturnType<typeof getDictionary>["tools"]["robotsTxtTester"];

function NoteList({ dict, title, notes, tone }: { dict: Dict; title: string; notes: RobotsNote[]; tone: string }) {
  if (notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className={cn("font-medium", tone)}>{title}</p>
      <ul className="list-disc space-y-0.5 pl-5">
        {notes.map((note) => (
          <li key={note.line} className="break-all">
            <span className="text-muted-foreground">{formatTemplate(dict.lineNumber, { line: note.line })} </span>
            <span className="font-mono">{note.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RobotsTxtTesterTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.robotsTxtTester;

  const [robots, setRobots] = React.useState("");
  const [agent, setAgent] = React.useState("Googlebot");
  const [urls, setUrls] = React.useState("");
  const [fileError, setFileError] = React.useState(false);

  const parsed = React.useMemo(() => parseRobots(robots), [robots]);
  const agentValid = isProductToken(agent.trim());
  const verdicts = agentValid ? checkUrls(parsed, agent, urls.split(/\r?\n/)) : [];
  const groupLines = verdicts.find((v) => v.status === "checked")?.groups.flatMap((g) => g.agents) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
        {dict.specNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>

      <TextInputPanel
        id="robots-txt"
        label={dict.robotsLabel}
        value={robots}
        onChange={setRobots}
        placeholder={"User-agent: *\nDisallow: /admin/"}
        openFileLabel={dict.openFile}
        onFileError={() => setFileError(true)}
        accept=".txt,text/plain"
      />
      {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="robots-agent" className="text-sm font-medium">
            {dict.agentLabel}
          </label>
          <Input
            id="robots-agent"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            spellCheck={false}
            aria-invalid={!agentValid || undefined}
            className="font-mono"
          />
          {!agentValid && <p className="text-sm text-destructive">{dict.agentError}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="robots-urls" className="text-sm font-medium">
            {dict.urlsLabel}
          </label>
          <Textarea
            id="robots-urls"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={"https://example.com/admin/\n/blog/post-1"}
            spellCheck={false}
            className="min-h-28 font-mono text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setRobots(SAMPLE_ROBOTS);
            setUrls(SAMPLE_URLS);
            // Googlebot は専用グループが適用されるため、* のルールを確認できる名前にする
            setAgent("ExampleBot");
          }}
        >
          <FlaskConical className="size-4" />
          {dict.loadSample}
        </Button>
        <ToolActions
          onClear={() => {
            setRobots("");
            setUrls("");
            setFileError(false);
          }}
          clearDisabled={!robots && !urls}
          getCopyText={() =>
            verdicts
              .map((v) =>
                v.status === "invalidUrl"
                  ? `${v.input}\t${dict.invalidUrl}`
                  : `${v.input}\t${v.allowed ? dict.allowed : dict.disallowed}\t${v.rule ? `${v.rule.line}: ${v.rule.type} ${v.rule.value}` : ""}`
              )
              .join("\n")
          }
          copyDisabled={verdicts.length === 0}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{dict.resultHeading}</h2>
        {verdicts.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {groupLines.length > 0
              ? formatTemplate(dict.groupUsed, {
                  lines: groupLines.map((a) => formatTemplate(dict.lineNumber, { line: a.line }) + ` ${a.value}`).join(", "),
                })
              : dict.noGroup}
          </p>
        )}
        {verdicts.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.emptyState}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{dict.columnUrl}</th>
                  <th className="px-3 py-2 font-medium">{dict.columnResult}</th>
                  <th className="px-3 py-2 font-medium">{dict.columnRule}</th>
                </tr>
              </thead>
              <tbody>
                {verdicts.map((verdict, index) => (
                  <tr key={index} className="border-t align-top">
                    <td className="break-all px-3 py-1.5 font-mono">
                      {verdict.input}
                      {verdict.status === "checked" && verdict.path !== verdict.input && (
                        <p className="text-xs text-muted-foreground">{verdict.path}</p>
                      )}
                    </td>
                    {verdict.status === "invalidUrl" ? (
                      <td colSpan={2} className="px-3 py-1.5 text-destructive">
                        {dict.invalidUrl}
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-1.5">
                          <span
                            className={cn(
                              "font-medium",
                              verdict.allowed ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                            )}
                          >
                            {verdict.allowed ? dict.allowed : dict.disallowed}
                          </span>
                          {verdict.reason !== "rule" && <p className="text-xs text-muted-foreground">{dict.reasons[verdict.reason]}</p>}
                        </td>
                        <td className="break-all px-3 py-1.5">
                          {verdict.rule && (
                            <span className="font-mono">
                              <span className="text-muted-foreground">{formatTemplate(dict.lineNumber, { line: verdict.rule.line })} </span>
                              {verdict.rule.type === "allow" ? "Allow" : "Disallow"}: {verdict.rule.value}
                            </span>
                          )}
                          {verdict.otherMatches.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {formatTemplate(dict.otherMatches, {
                                rules: verdict.otherMatches
                                  .map((r) => `${r.line}: ${r.type === "allow" ? "Allow" : "Disallow"} ${r.value}`)
                                  .join(", "),
                              })}
                            </p>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <NoteList dict={dict} title={dict.unsupportedHeading} notes={parsed.unsupported} tone="text-amber-700 dark:text-amber-400" />
        <NoteList dict={dict} title={dict.orphanHeading} notes={parsed.orphanRules} tone="text-amber-700 dark:text-amber-400" />
        <NoteList dict={dict} title={dict.invalidHeading} notes={parsed.invalid} tone="text-destructive" />
        <NoteList dict={dict} title={dict.sitemapHeading} notes={parsed.sitemaps} tone="text-muted-foreground" />
      </section>
    </div>
  );
}
