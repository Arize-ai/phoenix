import {
  formatValue,
  hasStringifiedJSON,
} from "@phoenix/components/code/JSONStringExpander";

describe("formatValue", () => {
  it("parses stringified objects", () => {
    expect(formatValue('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses objects with string values", () => {
    expect(formatValue('{"a": "b"}')).toEqual({ a: "b" });
  });

  it("parses stringified arrays", () => {
    expect(formatValue("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("parses arrays of objects", () => {
    expect(formatValue('[{"a": 1}, {"b": 2}]')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("parses nested JSON in objects", () => {
    expect(formatValue({ nested: '{"a": 1}' })).toEqual({
      nested: { a: 1 },
    });
  });

  it("parses nested JSON in arrays", () => {
    expect(formatValue(['{"a": 1}', '{"b": 2}'])).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("parses deeply nested structures", () => {
    expect(
      formatValue({
        key1: '{"a": 1}',
        key2: { nested: '{"b": 2}' },
      })
    ).toEqual({
      key1: { a: 1 },
      key2: { nested: { b: 2 } },
    });
  });

  it("handles mixed structures", () => {
    expect(
      formatValue({
        stringified: '{"a": 1}',
        array: ['{"b": 2}', 3],
        nested: { deep: '["x", "y"]' },
      })
    ).toEqual({
      stringified: { a: 1 },
      array: [{ b: 2 }, 3],
      nested: { deep: ["x", "y"] },
    });
  });

  it("preserves non-JSON strings", () => {
    expect(formatValue("not json")).toBe("not json");
    expect(formatValue("123")).toBe("123");
    expect(formatValue("true")).toBe("true");
  });

  it("preserves primitive values", () => {
    expect(formatValue(123)).toBe(123);
    expect(formatValue(true)).toBe(true);
    expect(formatValue(null)).toBe(null);
  });

  it("preserves already parsed objects", () => {
    const input = [{ a: 1 }, { b: 2 }];
    expect(formatValue(input)).toEqual(input);
  });
});

describe("hasStringifiedJSON", () => {
  describe("returns true for", () => {
    it("stringified objects", () => {
      expect(hasStringifiedJSON('{"a": 1}')).toBe(true);
    });

    it("nested stringified objects", () => {
      expect(hasStringifiedJSON('{"a": {"b": 1}}')).toBe(true);
    });

    it("stringified arrays", () => {
      expect(hasStringifiedJSON("[1, 2, 3]")).toBe(true);
    });

    it("stringified arrays of objects", () => {
      expect(hasStringifiedJSON('[{"a": 1}]')).toBe(true);
    });

    it("arrays containing JSON strings", () => {
      expect(hasStringifiedJSON(['{"a": 1}'])).toBe(true);
    });

    it("arrays with mixed JSON strings", () => {
      expect(hasStringifiedJSON([1, 2, '{"a": 1}'])).toBe(true);
    });

    it("objects with JSON string values", () => {
      expect(hasStringifiedJSON({ key: '{"a": 1}' })).toBe(true);
    });

    it("deeply nested JSON strings", () => {
      expect(hasStringifiedJSON({ nested: { deep: '{"a": 1}' } })).toBe(true);
    });
  });

  describe("returns false for", () => {
    it("non-JSON strings", () => {
      expect(hasStringifiedJSON("plain string")).toBe(false);
      expect(hasStringifiedJSON("123")).toBe(false);
      expect(hasStringifiedJSON("true")).toBe(false);
      expect(hasStringifiedJSON("null")).toBe(false);
    });

    it("primitive values", () => {
      expect(hasStringifiedJSON(123)).toBe(false);
      expect(hasStringifiedJSON(true)).toBe(false);
      expect(hasStringifiedJSON(null)).toBe(false);
    });

    it("objects without stringified JSON", () => {
      expect(hasStringifiedJSON({ a: 1 })).toBe(false);
      expect(hasStringifiedJSON({ a: { b: 1 } })).toBe(false);
    });

    it("arrays without stringified JSON", () => {
      expect(hasStringifiedJSON([1, 2, 3])).toBe(false);
      expect(hasStringifiedJSON([{ a: 1 }])).toBe(false);
    });

    it("invalid or malformed JSON strings", () => {
      expect(hasStringifiedJSON("{invalid}")).toBe(false);
      expect(hasStringifiedJSON("[1, 2,")).toBe(false);
    });
  });
});
