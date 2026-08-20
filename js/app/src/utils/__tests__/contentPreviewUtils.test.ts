import { describe, expect, it } from "vitest";

import {
  toContentPreview,
  toPreviewLine,
  toRecordPreview,
  toToolCallsPreview,
} from "../contentPreviewUtils";

describe("toPreviewLine", () => {
  // callers assembling a preview from several values flatten each with this and
  // truncate once at the end, so this must not truncate on its own
  it("flattens without truncating", () => {
    const long = "word ".repeat(100);
    expect(toPreviewLine(long)).toBe(long.trim());
  });

  it("returns an empty string for nothing", () => {
    expect(toPreviewLine(undefined)).toBe("");
    expect(toPreviewLine(null)).toBe("");
  });
});

describe("toContentPreview", () => {
  it("returns plain text unquoted", () => {
    expect(toContentPreview("Hi, I am your friendly assistant")).toBe(
      "Hi, I am your friendly assistant"
    );
  });

  it("collapses newlines and runs of whitespace onto one line", () => {
    expect(toContentPreview("first line\n\n  second\tline  ")).toBe(
      "first line second line"
    );
  });

  it("truncates past the max length with an ellipsis", () => {
    expect(toContentPreview("abcdefghij", { maxLength: 4 })).toBe("abcd…");
  });

  it("does not leave a trailing space before the ellipsis", () => {
    expect(toContentPreview("ab cdefgh", { maxLength: 3 })).toBe("ab…");
  });

  it("keeps content that is exactly the max length whole", () => {
    expect(toContentPreview("abcd", { maxLength: 4 })).toBe("abcd");
  });

  it("previews structured content as JSON", () => {
    expect(toContentPreview({ city: "SF" })).toBe('{ "city": "SF" }');
  });

  it("previews a JSON-encoded string as what it encodes", () => {
    expect(toContentPreview('"just some text"')).toBe("just some text");
    expect(toContentPreview('"{\\"temp\\": 75}"')).toBe('{"temp": 75}');
  });

  it("treats a JSON-encoded empty string as nothing to show", () => {
    expect(toContentPreview('""')).toBeUndefined();
  });

  it("leaves a plain string that merely starts with a quote alone", () => {
    expect(toContentPreview('"unterminated')).toBe('"unterminated');
  });

  // the quotes make it look encoded, so the unwrap is attempted and has to
  // leave the content untouched when it turns out not to parse
  it("leaves quoted content that is not valid JSON untouched", () => {
    expect(toContentPreview('"hello" she said"')).toBe('"hello" she said"');
    expect(toContentPreview('"')).toBe('"');
  });

  it("does not cut an emoji in half at the truncation point", () => {
    // the rocket is a surrogate pair straddling the limit
    expect(toContentPreview("abc🚀def", { maxLength: 4 })).toBe("abc…");
  });

  it("returns undefined for nothing worth showing", () => {
    expect(toContentPreview(undefined)).toBeUndefined();
    expect(toContentPreview(null)).toBeUndefined();
    expect(toContentPreview("")).toBeUndefined();
    expect(toContentPreview("   \n  ")).toBeUndefined();
  });
});

describe("toRecordPreview", () => {
  it("reads a JSON string as key: value pairs", () => {
    expect(
      toRecordPreview('{"temperature":0.7,"max_tokens":1000,"model":"gpt-4"}')
    ).toBe("temperature: 0.7, max_tokens: 1000, model: gpt-4");
  });

  it("reads an object the same way", () => {
    expect(toRecordPreview({ temperature: 0.7, stream: true })).toBe(
      "temperature: 0.7, stream: true"
    );
  });

  it("keeps a null value visible rather than blank", () => {
    expect(toRecordPreview({ seed: null })).toBe("seed: null");
  });

  it("flattens a nested value onto the line", () => {
    expect(toRecordPreview({ stop: ["\n", "END"] })).toBe(
      'stop: [ "\\n", "END" ]'
    );
  });

  it("falls back to a plain preview for content that is not a record", () => {
    expect(toRecordPreview('["a","b"]')).toBe('["a","b"]');
    expect(toRecordPreview(["a", "b"])).toBe('[ "a", "b" ]');
    expect(toRecordPreview("not json at all")).toBe("not json at all");
  });

  it("returns undefined for an empty or absent record", () => {
    expect(toRecordPreview("{}")).toBeUndefined();
    expect(toRecordPreview(undefined)).toBeUndefined();
  });

  // a prompt template's variables arrive as a record rather than a JSON string
  it("reads a record that did not arrive as a string", () => {
    expect(toRecordPreview({ question: "why?", tone: "friendly" })).toBe(
      "question: why?, tone: friendly"
    );
  });
});

describe("toToolCallsPreview", () => {
  it("shows what each tool was called with", () => {
    expect(
      toToolCallsPreview([
        { name: "get_weather", arguments: '{"city":"SF"}' },
        { name: "get_time", arguments: '{"tz":"PST"}' },
      ])
    ).toBe('get_weather({"city":"SF"}), get_time({"tz":"PST"})');
  });

  it("flattens arguments that arrive as an object", () => {
    expect(
      toToolCallsPreview([{ name: "get_weather", arguments: { city: "SF" } }])
    ).toBe('get_weather({ "city": "SF" })');
  });

  it("flattens arguments that span several lines", () => {
    expect(
      toToolCallsPreview([
        { name: "get_weather", arguments: '{\n  "city": "SF"\n}' },
      ])
    ).toBe('get_weather({ "city": "SF" })');
  });

  it("names a tool that was called with nothing", () => {
    expect(toToolCallsPreview([{ name: "list_tools" }])).toBe("list_tools()");
  });

  it("truncates the whole call rather than each argument", () => {
    expect(
      toToolCallsPreview([{ name: "search", arguments: '{"q":"abcdefgh"}' }], {
        maxLength: 12,
      })
    ).toBe('search({"q":…');
  });

  it("skips tool calls that have no name", () => {
    expect(
      toToolCallsPreview([{ name: null }, { name: "" }, { name: "search" }])
    ).toBe("search()");
  });

  it("returns undefined when nothing was called", () => {
    expect(toToolCallsPreview([])).toBeUndefined();
    expect(toToolCallsPreview([{ name: undefined }])).toBeUndefined();
  });
});
