export const MAX_INPUT = 1048576;
const MAX_LINE = 16384;
export type Property = { value: string; raw: string; source: string; params: Record<string, string> };
export type CalendarEvent = { fields: Record<string, Property[]>; warnings: string[] };

export function decodeCalendar(bytes: Uint8Array): string {
  if (bytes.length > MAX_INPUT) throw new Error(`Input limit: ${MAX_INPUT} bytes`);
  if ((bytes[0] === 255 && bytes[1] === 254) || (bytes[0] === 254 && bytes[1] === 255)) throw new Error("Invalid UTF-8; save as UTF-8.");
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10 && (bytes[i + 2] === 32 || bytes[i + 2] === 9)) { i += 2; continue; }
    if (bytes[i] === 10 && (bytes[i + 1] === 32 || bytes[i + 1] === 9)) { i++; continue; }
    out.push(bytes[i]);
  }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(out)); }
  catch { throw new Error("Invalid UTF-8; save as UTF-8."); }
}

const textFields = new Set(["SUMMARY", "DESCRIPTION", "LOCATION", "UID"]);
const singleFields = ["SUMMARY", "DESCRIPTION", "LOCATION", "UID", "DTSTAMP", "DTSTART", "DTEND", "DURATION", "RRULE", "RECURRENCE-ID"];
export function validDate(p: Property): boolean {
  const dateOnly = p.params.VALUE?.toUpperCase() === "DATE";
  const match = p.value.match(dateOnly ? /^(\d{4})(\d{2})(\d{2})$/ : /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if ((p.params.VALUE && !["DATE", "DATE-TIME"].includes(p.params.VALUE.toUpperCase())) || !match || (p.params.TZID && (dateOnly || match[7] === "Z"))) return false;
  const [, y, m, d, h = "0", min = "0", s = "0"] = match;
  const date = new Date(0); date.setUTCFullYear(Number(y), Number(m) - 1, Number(d));
  return Number(y) > 0 && date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d) && Number(h) < 24 && Number(min) < 60 && Number(s) <= 60;
}

export function parseCalendar(input: string): { method?: Property; events: CalendarEvent[] } {
  if (new TextEncoder().encode(input).length > MAX_INPUT) throw new Error(`Input limit: ${MAX_INPUT} bytes`);
  const lines: { text: string; line: number }[] = [];
  for (const [i, line] of input.replace(/^\uFEFF/, "").split(/\r?\n/).entries()) {
    if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1].text += line.slice(1);
    else lines.push({ text: line, line: i + 1 });
  }
  const stack: string[] = []; const events: CalendarEvent[] = [];
  let calendars = 0, version = false, method: Property | undefined, current: CalendarEvent | undefined;
  for (const { text, line } of lines) {
    if (new TextEncoder().encode(text).length > MAX_LINE) throw new Error(`Line ${line}: field limit ${MAX_LINE} bytes`);
    if (!text && line === lines[lines.length - 1].line) continue;
    let quote = false, colon = -1;
    for (let i = 0; i < text.length; i++) { if (text[i] === '"') quote = !quote; else if (text[i] === ":" && !quote) { colon = i; break; } }
    if (colon < 1 || quote) throw new Error(`Line ${line}: invalid property: ${text}`);
    const head = text.slice(0, colon); const parts = head.split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const name = parts.shift()?.toUpperCase() ?? "";
    if (!/^[A-Z0-9-]+$/.test(name)) throw new Error(`Line ${line}: invalid property: ${text}`);
    const params: Record<string, string> = {};
    for (const part of parts) {
      const m = part.match(/^([A-Za-z0-9-]+)=("[^"]*"|[^";:]*)$/);
      if (!m) throw new Error(`Line ${line}: invalid parameter: ${text}`);
      params[m[1].toUpperCase()] = m[2].replace(/^"|"$/g, "");
    }
    const raw = text.slice(colon + 1); const value = textFields.has(name) ? raw.replace(/\\([nN,;\\])/g, (_, c: string) => c.toLowerCase() === "n" ? "\n" : c) : raw;
    const p = { raw, value, params, source: text };
    if (name === "BEGIN") {
      const component = raw.toUpperCase();
      if (!/^[A-Z0-9-]+$/.test(component) || (!stack.length && component !== "VCALENDAR") || (component === "VCALENDAR" && stack.length)) throw new Error(`Line ${line}: invalid BEGIN: ${text}`);
      if (component === "VCALENDAR") calendars++;
      if (component === "VEVENT" && stack.length === 1 && stack[0] === "VCALENDAR") { if (events.length >= 500) throw new Error("Event limit: 500"); current = { fields: {}, warnings: [] }; events.push(current); }
      stack.push(component); continue;
    }
    if (name === "END") {
      if (!stack.length || stack.pop() !== raw.toUpperCase()) throw new Error(`Line ${line}: unmatched END: ${text}`);
      if (raw.toUpperCase() === "VEVENT" && stack.length === 1) current = undefined;
      continue;
    }
    if (!stack.length) throw new Error(`Line ${line}: property outside VCALENDAR: ${text}`);
    if (stack.length === 1 && name === "VERSION" && value === "2.0") version = true;
    if (stack.length === 1 && name === "METHOD") method = p;
    if (stack.length === 2 && stack[1] === "VEVENT" && current) (current.fields[name] ??= []).push(p);
  }
  if (stack.length || calendars !== 1 || !version) throw new Error("Invalid VCALENDAR structure or VERSION:2.0 missing.");
  for (const e of events) {
    for (const name of ["UID", "DTSTAMP", ...(!method ? ["DTSTART"] : [])]) if (!e.fields[name]?.length) e.warnings.push(`${name}: missing`);
    for (const name of singleFields) if ((e.fields[name]?.length ?? 0) > 1) e.warnings.push(`${name}: duplicate`);
    if (e.fields.DTEND && e.fields.DURATION) e.warnings.push("DTEND / DURATION: both specified");
    for (const name of ["DTSTART", "DTEND", "DTSTAMP", "RECURRENCE-ID"]) for (const p of e.fields[name] ?? []) if (!validDate(p)) e.warnings.push(`${name}: invalid ${p.source}`);
  }
  return { method, events };
}
