import { describe, expect, it } from "vitest";
import { decodeCalendar, parseCalendar, validDate } from "./icalendar";

const calendar = (body: string) => `BEGIN:VCALENDAR\nVERSION:2.0\n${body}\nEND:VCALENDAR`;
const event = (body: string) => `BEGIN:VEVENT\nUID:x\nDTSTAMP:20261120T120000Z\n${body}\nEND:VEVENT`;

describe("iCalendar preview", () => {
  it("unfolds bytes before strict UTF-8 decoding", () => {
    const bytes = new TextEncoder().encode("日😀");
    expect(decodeCalendar(new Uint8Array([...bytes.slice(0, 2), 13, 10, 32, ...bytes.slice(2)]))).toBe("日😀");
    expect(() => decodeCalendar(new Uint8Array([255, 254]))).toThrow();
    expect(() => decodeCalendar(new Uint8Array([255]))).toThrow();
  });
  it("reads direct events and keeps quoted parameters, text and nested alarms separate", () => {
    const result = parseCalendar(calendar(event('DTSTART;TZID="Asia/Tokyo:local":20261120T120000\nSUMMARY: <b>\\,x\\ntext \nBEGIN:VALARM\nDESCRIPTION:hidden\nEND:VALARM\nATTENDEE:mailto:a@example.com')));
    expect(result.events[0].fields.SUMMARY[0].value).toBe(" <b>,x\ntext ");
    expect(result.events[0].fields.DTSTART[0].params.TZID).toBe("Asia/Tokyo:local");
    expect(result.events[0].fields.DESCRIPTION).toBeUndefined();
    expect(result.events[0].fields.ATTENDEE[0].value).toBe("mailto:a@example.com");
  });
  it("validates all-day, UTC, zoned and floating dates without converting them", () => {
    const e = parseCalendar(calendar(event("DTSTART;VALUE=DATE:20261120\nDTEND;VALUE=DATE:20261121\nRECURRENCE-ID;TZID=Asia/Tokyo:20261120T120000\nRDATE:20261121T120000Z\nEXDATE:20261122T120000"))).events[0];
    expect(validDate(e.fields.DTSTART[0])).toBe(true);
    expect(validDate(e.fields.DTEND[0])).toBe(true);
    expect(validDate(e.fields["RECURRENCE-ID"][0])).toBe(true);
    expect(validDate({ value: "20261120T120000", raw: "", source: "", params: {} })).toBe(true);
    expect(e.fields.RDATE[0].value).toBe("20261121T120000Z");
    expect(e.warnings).toEqual([]);
  });
  it("rejects malformed structure, missing version and multiple calendars", () => {
    for (const input of [calendar("BEGIN:VEVENT\nEND:VCALENDAR"), "BEGIN:VCALENDAR\nEND:VCALENDAR", calendar("") + "\n" + calendar(""), calendar("BROKEN")]) expect(() => parseCalendar(input)).toThrow();
  });
  it("warns for invalid and missing fields without discarding values", () => {
    const e = parseCalendar(calendar("BEGIN:VEVENT\nDTSTART;TZID=X:20260230T120000Z\nDTEND;VALUE=DATE;TZID=X:20261121\nDURATION:P1D\nSUMMARY:a\nSUMMARY:b\nEND:VEVENT")).events[0];
    expect(e.warnings.join(" ")).toMatch(/UID/);
    expect(e.warnings.join(" ")).toMatch(/DTSTAMP/);
    expect(e.warnings.join(" ")).toMatch(/DTSTART/);
    expect(e.warnings.join(" ")).toMatch(/DTEND/);
    expect(e.warnings.join(" ")).toMatch(/SUMMARY/);
    expect(e.fields.SUMMARY.map((v) => v.value)).toEqual(["a", "b"]);
  });
  it("enforces input, unfolded line and event limits", () => {
    expect(() => parseCalendar("x".repeat(1048577))).toThrow(/1048576/);
    expect(() => parseCalendar(calendar(`X:${"x".repeat(16383)}`))).toThrow(/16384/);
    expect(() => parseCalendar(calendar(Array(501).fill(event("DTSTART:20261120T120000")).join("\n")))).toThrow(/500/);
    expect(parseCalendar(calendar(Array(500).fill(event("DTSTART:20261120T120000")).join("\n"))).events).toHaveLength(500);
    expect(() => parseCalendar(calendar(`X:${"x".repeat(16382)}`))).not.toThrow();
  });
});
