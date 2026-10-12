import { afterEach, describe, expect, it, vi } from "vitest";

import { getJSONDisplayPreview } from "../getJSONDisplayPreview";

const format = (value: unknown) => JSON.stringify(value, null, 2);
afterEach(() => vi.restoreAllMocks());

describe("getJSONDisplayPreview", () => {
  it("recursively previews encoded objects and arrays inside arrays", () => {
    const source = {
      payload: JSON.stringify({
        items: [JSON.stringify({ reason: "grounded", score: 1 })],
        nested: JSON.stringify([
          "prose",
          { more: JSON.stringify({ ok: true }) },
        ]),
      }),
      native: [JSON.stringify([1, { note: "kept" }])],
    };
    expect(getJSONDisplayPreview({ text: format(source) })).toEqual({
      text: format({
        payload: {
          items: [{ reason: "grounded", score: 1 }],
          nested: ["prose", { more: { ok: true } }],
        },
        native: [[1, { note: "kept" }]],
      }),
      hasDecodedStrings: true,
    });
    expect(typeof source.payload).toBe("string");
    expect(typeof source.native[0]).toBe("string");
  });

  it("unwraps several encoding layers only when they lead to a container", () => {
    let encoded = JSON.stringify({ items: [1, 2], empty: {} });
    for (let layer = 0; layer < 4; layer++) encoded = JSON.stringify(encoded);
    expect(
      getJSONDisplayPreview({ text: format({ payload: encoded }) })
    ).toEqual({
      text: format({ payload: { items: [1, 2], empty: {} } }),
      hasDecodedStrings: true,
    });
    expect(getJSONDisplayPreview({ text: format(encoded) })).toEqual({
      text: format({ items: [1, 2], empty: {} }),
      hasDecodedStrings: true,
    });
  });

  it("handles escaped quotes, backslashes, newlines and hostile HTML as data", () => {
    const decoded = {
      quote: 'She said "yes"',
      path: "C:\\folder\\file",
      lines: "first\nsecond",
      html: '<img src=x onerror="alert(1)"><script>alert(1)</script>',
    };
    expect(
      getJSONDisplayPreview({
        text: format({ payload: JSON.stringify(decoded) }),
      })
    ).toEqual({
      text: format({ payload: decoded }),
      hasDecodedStrings: true,
    });
  });

  it("keeps mixed primitive-looking, malformed and multiply quoted strings exact", () => {
    const strings = [
      "",
      "123",
      "0",
      "true",
      "false",
      "null",
      '"literal"',
      JSON.stringify(JSON.stringify("hello")),
      '{"bad":',
      "[1,",
      '"{bad}"',
      " ordinary prose ",
    ];
    const source = {
      strings,
      native: [1, true, null],
      decoded: JSON.stringify({ values: strings }),
    };
    expect(getJSONDisplayPreview({ text: format(source) })).toEqual({
      text: format({
        strings,
        native: [1, true, null],
        decoded: { values: strings },
      }),
      hasDecodedStrings: true,
    });
  });

  it.each([
    {},
    [],
    null,
    0,
    false,
    true,
    "",
    "123",
    "true",
    "null",
    '"quoted literal"',
    ["{} not JSON"],
    { literal: '"hello"' },
  ])("does not label unchanged values: %j", (value) => {
    const text = format(value);
    expect(getJSONDisplayPreview({ text })).toEqual({
      text,
      hasDecodedStrings: false,
    });
  });
  it.each(["", "text", '{"broken":', '["unterminated'])(
    "preserves invalid top-level input: %s",
    (text) => {
      expect(getJSONDisplayPreview({ text })).toEqual({
        text,
        hasDecodedStrings: false,
      });
    }
  );
  it("decodes empty containers without replacing them with placeholders", () => {
    expect(getJSONDisplayPreview({ text: format(["{}", "[]"]) })).toEqual({
      text: format([{}, []]),
      hasDecodedStrings: true,
    });
  });
  it("treats prototype keys as ordinary own data, without mutating prototypes", () => {
    const source = Object.fromEntries([
      ["__proto__", JSON.stringify({ polluted: true })],
      ["constructor", JSON.stringify({ prototype: { polluted: true } })],
      ["prototype", JSON.stringify(["safe"])],
    ]);
    const original = format(source);
    const result = getJSONDisplayPreview({ text: original });
    const preview = JSON.parse(result.text);
    expect(Object.hasOwn(preview, "__proto__")).toBe(true);
    expect(preview.__proto__).toEqual({ polluted: true });
    expect(preview.constructor).toEqual({ prototype: { polluted: true } });
    expect(Object.getPrototypeOf(source)).toBe(Object.prototype);
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
    expect(format(source)).toBe(original);
  });

  it("falls back as a whole when container depth exceeds the bound", () => {
    const text = format({ early: "{}", deep: { next: { payload: "[]" } } });
    expect(getJSONDisplayPreview({ text, maxDepth: 2 })).toEqual({
      text,
      hasDecodedStrings: false,
    });
  });
  it("counts repeated encoding layers toward the same depth bound", () => {
    const encoded = JSON.stringify(
      JSON.stringify(JSON.stringify({ ok: true }))
    );
    const text = format({ early: "{}", encoded });
    expect(getJSONDisplayPreview({ text, maxDepth: 2 })).toEqual({
      text,
      hasDecodedStrings: false,
    });
  });
  it("limits total visited nodes across branches, not just each container", () => {
    const text = format({ early: "{}", left: [1, 2, 3], right: [4, 5, 6] });
    expect(getJSONDisplayPreview({ text, maxNodes: 8 })).toEqual({
      text,
      hasDecodedStrings: false,
    });
  });
  it("limits all parse attempts including malformed candidates", () => {
    const text = format([
      "{}",
      ...Array.from({ length: 100 }, () => "{broken"),
    ]);
    const parse = vi.spyOn(JSON, "parse");
    expect(getJSONDisplayPreview({ text, maxParseAttempts: 3 })).toEqual({
      text,
      hasDecodedStrings: false,
    });
    expect(parse).toHaveBeenCalledTimes(3);
  });
  it("skips an oversized source without attempting to parse it", () => {
    const text = format({ payload: "{}" });
    const parse = vi.spyOn(JSON, "parse");
    expect(
      getJSONDisplayPreview({ text, maxCharacters: text.length - 1 })
    ).toEqual({ text, hasDecodedStrings: false });
    expect(parse).not.toHaveBeenCalled();
  });
  it("limits cumulative parse characters rather than each string alone", () => {
    const text = format(["{}", "[]"]);
    expect(
      getJSONDisplayPreview({ text, maxCharacters: text.length + 2 })
    ).toEqual({ text, hasDecodedStrings: false });
  });
  it("discards an oversized formatted preview without truncating the source", () => {
    const text = JSON.stringify({
      payload: JSON.stringify({ deep: { values: [1, 2, 3, 4] } }),
    });
    const expanded = getJSONDisplayPreview({ text });
    expect(expanded.hasDecodedStrings).toBe(true);
    const parseSize = text.length + JSON.parse(text).payload.length;
    expect(expanded.text.length).toBeGreaterThan(parseSize);
    expect(getJSONDisplayPreview({ text, maxCharacters: parseSize })).toEqual({
      text,
      hasDecodedStrings: false,
    });
  });
});
