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
      textType: "json",
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
      textType: "json",
    });
    expect(getJSONDisplayPreview({ text: format(encoded) })).toEqual({
      text: format({ items: [1, 2], empty: {} }),
      hasDecodedStrings: true,
      textType: "json",
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
      textType: "json",
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
      textType: "json",
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
      textType: "json",
    });
  });
  it.each(["", "text", '{"broken":', '["unterminated'])(
    "preserves invalid top-level input: %s",
    (text) => {
      expect(getJSONDisplayPreview({ text })).toEqual({
        text,
        hasDecodedStrings: false,
        textType: "string",
      });
    }
  );
  it("decodes empty containers without replacing them with placeholders", () => {
    expect(getJSONDisplayPreview({ text: format(["{}", "[]"]) })).toEqual({
      text: format([{}, []]),
      hasDecodedStrings: true,
      textType: "json",
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
      textType: "json",
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
      textType: "json",
    });
  });
  it("limits total visited nodes across branches, not just each container", () => {
    const text = format({ early: "{}", left: [1, 2, 3], right: [4, 5, 6] });
    expect(getJSONDisplayPreview({ text, maxNodes: 8 })).toEqual({
      text,
      hasDecodedStrings: false,
      textType: "json",
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
      textType: "json",
    });
    expect(parse).toHaveBeenCalledTimes(3);
  });
  it("skips an oversized source without attempting to parse it", () => {
    const text = format({ payload: "{}" });
    const parse = vi.spyOn(JSON, "parse");
    expect(
      getJSONDisplayPreview({ text, maxCharacters: text.length - 1 })
    ).toEqual({ text, hasDecodedStrings: false, textType: "string" });
    expect(parse).not.toHaveBeenCalled();
  });
  it("limits cumulative parse characters rather than each string alone", () => {
    const text = format(["{}", "[]"]);
    expect(
      getJSONDisplayPreview({ text, maxCharacters: text.length + 2 })
    ).toEqual({ text, hasDecodedStrings: false, textType: "json" });
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
      textType: "json",
    });
  });
  // RAW numeric tokens: constructing JS number fixtures would round them before
  // the production parser sees them. Expectations deliberately keep the literals.
  it.each([
    "9007199254740993",
    "-9007199254740993",
    "1e400",
    "-1e400",
    "1e-400",
    "-1e-400",
    "0.12345678901234567890123456789",
    "1.0000000000000001",
    "0.100000000000000005",
    "9007199254740992.1",
    "1000000000000000000001",
    "-0",
    "-0.0",
    "-0e3",
  ])(
    "keeps the complete original source for unsafe numeric token %s",
    (token) => {
      const inner = `{"value":${token}}`;
      const sources = [
        ` \t${token}\n`,
        `  ${inner}  `,
        JSON.stringify({ early: '{"safe":[1,2]}', payload: inner }),
        JSON.stringify([JSON.stringify(JSON.stringify(inner))]),
      ];
      for (const text of sources) {
        expect(getJSONDisplayPreview({ text })).toEqual({
          text,
          hasDecodedStrings: false,
          textType: "json",
        });
      }
    }
  );
  it.each([
    ["1.0", "1"],
    ["1e3", "1000"],
    ["1E+03", "1000"],
    ["0.1", "0.1"],
    ["1.2300", "1.23"],
    ["100.00e-2", "1"],
    ["-12.5e+2", "-1250"],
    ["5e-324", "5e-324"],
    ["1e-323", "1e-323"],
    ["1.7976931348623157e308", "1.7976931348623157e+308"],
    ["1000000000000000000000", "1e+21"],
    ["9007199254740992", "9007199254740992"],
    ["0e99999999999999999999", "0"],
  ])("formats equivalent safe decimal %s as %s", (token, expected) => {
    const text = `{ "value": ${token} }`;
    expect(getJSONDisplayPreview({ text })).toEqual({
      text: `{\n  "value": ${expected}\n}`,
      hasDecodedStrings: false,
      textType: "json",
    });
    expect(
      getJSONDisplayPreview({ text: JSON.stringify({ payload: text }) })
    ).toEqual({
      text: `{\n  "payload": {\n    "value": ${expected}\n  }\n}`,
      hasDecodedStrings: true,
      textType: "json",
    });
  });
  it("ignores numerical text in keys/strings, including escapes and Unicode", () => {
    const strings = [
      "9007199254740993",
      "1e400",
      "1e-400",
      "-0",
      '"1e400"',
      'C:\\guide\n"9007199254740993"',
      "☃ 1e400",
    ];
    const source = Object.fromEntries([
      ["1e400", strings],
      ['escaped"-0', strings],
      ["__proto__", JSON.stringify({ strings, safe: 0.1 })],
    ]);
    const text = JSON.stringify(source);
    expect(getJSONDisplayPreview({ text })).toEqual({
      text: format(
        Object.fromEntries([
          ["1e400", strings],
          ['escaped"-0', strings],
          ["__proto__", { strings, safe: 0.1 }],
        ])
      ),
      hasDecodedStrings: true,
      textType: "json",
    });
    expect(
      getJSONDisplayPreview({ text: '{"\\u0031e400":"\\u0031e-400"}' })
    ).toEqual({
      text: '{\n  "1e400": "1e-400"\n}',
      hasDecodedStrings: false,
      textType: "json",
    });
    expect(Object.hasOwn(Object.prototype, "strings")).toBe(false);
    expect(JSON.stringify(source)).toBe(text);
  });
  it.each(['{"value":01}', "[1e]", '{"value":1.}', "1e400oops"])(
    "validates malformed numeric JSON before scanning: %s",
    (text) => {
      expect(getJSONDisplayPreview({ text })).toEqual({
        text,
        hasDecodedStrings: false,
        textType: "string",
      });
    }
  );
  it("handles long significands/exponents with bounded work and exact comparison", () => {
    const equivalent = `1${"0".repeat(2000)}e-2000`;
    expect(getJSONDisplayPreview({ text: equivalent })).toEqual({
      text: "1",
      hasDecodedStrings: false,
      textType: "json",
    });
    const precise = `1.${"0".repeat(2000)}1`;
    expect(getJSONDisplayPreview({ text: precise })).toEqual({
      text: precise,
      hasDecodedStrings: false,
      textType: "json",
    });
    const oversized = "9".repeat(100_001);
    const parse = vi.spyOn(JSON, "parse");
    expect(getJSONDisplayPreview({ text: oversized })).toEqual({
      text: oversized,
      hasDecodedStrings: false,
      textType: "string",
    });
    expect(parse).not.toHaveBeenCalled();
  });
  it("applies budgets before outer formatting and falls back atomically to raw text", () => {
    const deep = "[".repeat(25) + "1" + "]".repeat(25);
    expect(getJSONDisplayPreview({ text: deep })).toEqual({
      text: deep,
      hasDecodedStrings: false,
      textType: "json",
    });
    const text = '{"values":[0,1,2]}';
    expect(getJSONDisplayPreview({ text, maxCharacters: text.length })).toEqual(
      { text, hasDecodedStrings: false, textType: "json" }
    );
    const mixed = JSON.stringify({
      safe: '{"ok":true}',
      values: ['{"id":9007199254740993}'],
    });
    expect(getJSONDisplayPreview({ text: mixed })).toEqual({
      text: mixed,
      hasDecodedStrings: false,
      textType: "json",
    });
  });
});
