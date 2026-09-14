import { describe, expect, it } from "vitest";

import { tokenizeJson } from "../jsonTokens";

describe("tokenizeJson", () => {
  it("tells keys from string values and marks numbers and literals", () => {
    const tokens = tokenizeJson(
      '{\n  "a": "b",\n  "n": -1.5e3,\n  "ok": true\n}'
    );
    expect(tokens.map((token) => [token.kind, token.text])).toEqual([
      ["punctuation", "{"],
      ["text", "\n  "],
      ["key", '"a"'],
      ["punctuation", ":"],
      ["text", " "],
      ["string", '"b"'],
      ["punctuation", ","],
      ["text", "\n  "],
      ["key", '"n"'],
      ["punctuation", ":"],
      ["text", " "],
      ["number", "-1.5e3"],
      ["punctuation", ","],
      ["text", "\n  "],
      ["key", '"ok"'],
      ["punctuation", ":"],
      ["text", " "],
      ["literal", "true"],
      ["text", "\n"],
      ["punctuation", "}"],
    ]);
  });

  it("keeps escaped quotes inside a string", () => {
    expect(tokenizeJson('"a \\" b"')).toEqual([
      { kind: "string", text: '"a \\" b"' },
    ]);
  });

  it("renders an unclosed string and a plain-text note without losing text", () => {
    const text = '{\n  "a": "unclosed\n… 12 more characters.';
    expect(
      tokenizeJson(text)
        .map((token) => token.text)
        .join("")
    ).toBe(text);
    expect(tokenizeJson("… 12 more characters.")).toEqual([
      { kind: "text", text: "… 12 more characters." },
    ]);
  });
});
