import {
  formatValue,
  hasStringifiedJSON,
} from "../AttributesJSONBlock";

describe("formatValue", () => {
  it("parses stringified objects", () => {
    expect(formatValue('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses objects with string values", () => {
    expect(formatValue('{"a": "b"}')).toEqual({ a: "b" });
  });

  it("parses stringified arrays", () => {
    expect(formatValue('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it("parses arrays of objects", () => {
    expect(formatValue('[{"a": 1}, {"b": 2}]')).toEqual([
      { a: 1 },
      { b: 2 },
    ]);
  });

  it("parses nested JSON in objects", () => {
    expect(formatValue({ nested: '{"a": 1}' })).toEqual({
      nested: { a: 1 },
    });
  });

  it("parses nested JSON in arrays", () => {
    expect(formatValue(['{"a": 1}', '{"b": 2}'])).toEqual([
      { a: 1 },
      { b: 2 },
    ]);
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

  it("returns plain text unchanged", () => {
    expect(formatValue("not json")).toEqual("not json");
  });

  it("returns numeric strings unchanged", () => {
    expect(formatValue("123")).toEqual("123");
  });

  it("returns boolean strings unchanged", () => {
    expect(formatValue("true")).toEqual("true");
  });

  it("returns numbers unchanged", () => {
    expect(formatValue(123)).toEqual(123);
  });

  it("returns booleans unchanged", () => {
    expect(formatValue(true)).toEqual(true);
  });

  it("returns null unchanged", () => {
    expect(formatValue(null)).toEqual(null);
  });

  it("returns parsed objects unchanged", () => {
    expect(formatValue([{ a: 1 }, { b: 2 }])).toEqual([
      { a: 1 },
      { b: 2 },
    ]);
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
      expect(hasStringifiedJSON('[1, 2, 3]')).toBe(true);
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
    it("plain text", () => {
      expect(hasStringifiedJSON("plain string")).toBe(false);
    });

    it("numeric strings", () => {
      expect(hasStringifiedJSON("123")).toBe(false);
    });

    it("boolean strings", () => {
      expect(hasStringifiedJSON("true")).toBe(false);
    });

    it("numbers", () => {
      expect(hasStringifiedJSON(123)).toBe(false);
    });

    it("booleans", () => {
      expect(hasStringifiedJSON(true)).toBe(false);
    });

    it("null", () => {
      expect(hasStringifiedJSON(null)).toBe(false);
    });

    it("plain objects", () => {
      expect(hasStringifiedJSON({ a: 1 })).toBe(false);
    });

    it("nested objects", () => {
      expect(hasStringifiedJSON({ a: { b: 1 } })).toBe(false);
    });

    it("plain arrays", () => {
      expect(hasStringifiedJSON([1, 2, 3])).toBe(false);
    });

    it("arrays of objects", () => {
      expect(hasStringifiedJSON([{ a: 1 }])).toBe(false);
    });

    it("invalid JSON", () => {
      expect(hasStringifiedJSON("{invalid}")).toBe(false);
    });

    it("malformed JSON", () => {
      expect(hasStringifiedJSON("[1, 2,")).toBe(false);
    });
  });
});
