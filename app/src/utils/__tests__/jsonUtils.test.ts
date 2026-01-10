import {
  flattenObject,
  isJSONObjectString,
  jsonStringToFlatObject,
  safelyJSONStringify,
  safelyParseJSONObjectString,
  safelyParseJSONString,
  unnestSingleStringValue,
} from "../jsonUtils";

describe("isJSONObjectString", () => {
  it("detects invalid JSON and JSON that's not objects", () => {
    expect(isJSONObjectString("")).toEqual(false);
    expect(isJSONObjectString("123")).toEqual(false);
    expect(isJSONObjectString("[]")).toEqual(false);
    expect(isJSONObjectString("[1, 2, 3]")).toEqual(false);
    expect(isJSONObjectString("{")).toEqual(false);
    expect(isJSONObjectString("{]")).toEqual(false);
    expect(isJSONObjectString("{1: 2}")).toEqual(false);
    expect(isJSONObjectString("{1, 2}")).toEqual(false);
    expect(isJSONObjectString("{1: 2, 3}")).toEqual(false);
  });
  it("detects valid JSON objects", () => {
    expect(isJSONObjectString("{}")).toEqual(true);
    expect(isJSONObjectString('{"a": 1}')).toEqual(true);
    expect(isJSONObjectString('{"a": "b"}')).toEqual(true);
    expect(isJSONObjectString('{"a": {"b": 1}}')).toEqual(true);
    expect(isJSONObjectString('{"a": [1, 2, 3]}')).toEqual(true);
  });
});

describe("flattenObject", () => {
  describe("basic flattening", () => {
    it("returns empty object for empty input", () => {
      expect(flattenObject({ obj: {} })).toEqual({});
    });

    it("flattens simple objects with no nesting", () => {
      expect(flattenObject({ obj: { a: 1, b: 2 } })).toEqual({ a: 1, b: 2 });
    });

    it("flattens single-level nested objects", () => {
      expect(flattenObject({ obj: { a: { b: 1 } } })).toEqual({ "a.b": 1 });
    });

    it("flattens deeply nested objects", () => {
      expect(flattenObject({ obj: { a: { b: { c: { d: 1 } } } } })).toEqual({
        "a.b.c.d": 1,
      });
    });

    it("flattens objects with multiple branches", () => {
      expect(
        flattenObject({
          obj: {
            a: { b: 1 },
            c: { d: 2 },
            e: 3,
          },
        })
      ).toEqual({
        "a.b": 1,
        "c.d": 2,
        e: 3,
      });
    });

    it("handles various primitive types as values", () => {
      expect(
        flattenObject({
          obj: {
            num: 42,
            str: "hello",
            bool: true,
            falseBool: false,
            zero: 0,
          },
        })
      ).toEqual({
        num: 42,
        str: "hello",
        bool: true,
        falseBool: false,
        zero: 0,
      });
    });
  });

  describe("separator parameter", () => {
    it("uses default dot separator", () => {
      expect(flattenObject({ obj: { a: { b: 1 } } })).toEqual({ "a.b": 1 });
    });

    it("uses custom separator when provided", () => {
      expect(flattenObject({ obj: { a: { b: 1 } }, separator: "/" })).toEqual({
        "a/b": 1,
      });
    });

    it("uses underscore separator", () => {
      expect(flattenObject({ obj: { a: { b: 1 } }, separator: "_" })).toEqual({
        a_b: 1,
      });
    });

    it("uses multi-character separator", () => {
      expect(flattenObject({ obj: { a: { b: 1 } }, separator: "->" })).toEqual({
        "a->b": 1,
      });
    });

    it("applies separator throughout deep nesting", () => {
      expect(
        flattenObject({
          obj: { a: { b: { c: { d: 1 } } } },
          separator: "::",
        })
      ).toEqual({
        "a::b::c::d": 1,
      });
    });
  });

  describe("parentKey parameter", () => {
    it("uses no parent key by default", () => {
      expect(flattenObject({ obj: { a: 1 } })).toEqual({ a: 1 });
    });

    it("prepends parent key to all keys", () => {
      expect(flattenObject({ obj: { a: 1, b: 2 }, parentKey: "root" })).toEqual(
        {
          "root.a": 1,
          "root.b": 2,
        }
      );
    });

    it("combines parent key with nested objects", () => {
      expect(
        flattenObject({ obj: { a: { b: 1 } }, parentKey: "prefix" })
      ).toEqual({
        "prefix.a.b": 1,
      });
    });

    it("uses parent key with custom separator", () => {
      expect(
        flattenObject({
          obj: { a: { b: 1 } },
          parentKey: "root",
          separator: "/",
        })
      ).toEqual({
        "root/a/b": 1,
      });
    });
  });

  describe("keepNonTerminalValues parameter", () => {
    it("excludes non-terminal values by default", () => {
      const result = flattenObject({ obj: { a: { b: 1 } } });
      expect(result).toEqual({ "a.b": 1 });
      expect(result).not.toHaveProperty("a");
    });

    it("keeps non-terminal values when enabled", () => {
      const result = flattenObject({
        obj: { a: { b: 1 } },
        keepNonTerminalValues: true,
      });
      expect(result).toEqual({
        a: { b: 1 },
        "a.b": 1,
      });
    });

    it("keeps all intermediate values in deep nesting", () => {
      const result = flattenObject({
        obj: { a: { b: { c: 1 } } },
        keepNonTerminalValues: true,
      });
      expect(result).toEqual({
        a: { b: { c: 1 } },
        "a.b": { c: 1 },
        "a.b.c": 1,
      });
    });

    it("keeps non-terminal values for multiple branches", () => {
      const result = flattenObject({
        obj: {
          x: { y: 1 },
          a: { b: { c: 2 } },
        },
        keepNonTerminalValues: true,
      });
      expect(result).toEqual({
        x: { y: 1 },
        "x.y": 1,
        a: { b: { c: 2 } },
        "a.b": { c: 2 },
        "a.b.c": 2,
      });
    });

    it("keeps non-terminal array values when enabled", () => {
      const result = flattenObject({
        obj: { items: [1, 2] },
        keepNonTerminalValues: true,
      });
      expect(result["items"]).toEqual([1, 2]);
      expect(result["items.0"]).toBe(1);
      expect(result["items.1"]).toBe(2);
    });

    it("combines keepNonTerminalValues with custom separator", () => {
      const result = flattenObject({
        obj: { a: { b: 1 } },
        keepNonTerminalValues: true,
        separator: "/",
      });
      expect(result).toEqual({
        a: { b: 1 },
        "a/b": 1,
      });
    });
  });

  describe("formatIndices parameter", () => {
    it("uses dot notation for array indices by default", () => {
      expect(flattenObject({ obj: { items: [1, 2, 3] } })).toEqual({
        "items.0": 1,
        "items.1": 2,
        "items.2": 3,
      });
    });

    it("uses bracket notation when formatIndices is true", () => {
      expect(
        flattenObject({ obj: { items: [1, 2, 3] }, formatIndices: true })
      ).toEqual({
        "items[0]": 1,
        "items[1]": 2,
        "items[2]": 3,
      });
    });

    it("formats indices in nested arrays", () => {
      expect(
        flattenObject({
          obj: { outer: { inner: ["a", "b"] } },
          formatIndices: true,
        })
      ).toEqual({
        "outer.inner[0]": "a",
        "outer.inner[1]": "b",
      });
    });

    it("formats indices in array of objects", () => {
      expect(
        flattenObject({
          obj: { users: [{ name: "Alice" }, { name: "Bob" }] },
          formatIndices: true,
        })
      ).toEqual({
        "users[0].name": "Alice",
        "users[1].name": "Bob",
      });
    });

    it("handles nested arrays with formatIndices", () => {
      expect(
        flattenObject({
          obj: {
            matrix: [
              [1, 2],
              [3, 4],
            ],
          },
          formatIndices: true,
        })
      ).toEqual({
        "matrix[0][0]": 1,
        "matrix[0][1]": 2,
        "matrix[1][0]": 3,
        "matrix[1][1]": 4,
      });
    });

    it("combines formatIndices with custom separator", () => {
      expect(
        flattenObject({
          obj: { data: { items: [1, 2] } },
          formatIndices: true,
          separator: "/",
        })
      ).toEqual({
        "data/items[0]": 1,
        "data/items[1]": 2,
      });
    });

    it("combines formatIndices with keepNonTerminalValues", () => {
      const result = flattenObject({
        obj: { items: [{ a: 1 }] },
        formatIndices: true,
        keepNonTerminalValues: true,
      });
      expect(result).toEqual({
        items: [{ a: 1 }],
        "items[0]": { a: 1 },
        "items[0].a": 1,
      });
    });

    it("handles empty arrays", () => {
      expect(
        flattenObject({ obj: { empty: [] }, formatIndices: true })
      ).toEqual({});
    });

    it("handles top-level array", () => {
      expect(
        flattenObject({
          obj: ["first", "second"],
          formatIndices: true,
        })
      ).toEqual({
        "[0]": "first",
        "[1]": "second",
      });
    });
  });

  describe("complex combinations", () => {
    it("combines all parameters together", () => {
      const result = flattenObject({
        obj: { data: [{ value: 1 }] },
        parentKey: "root",
        separator: "/",
        keepNonTerminalValues: true,
        formatIndices: true,
      });
      expect(result).toEqual({
        "root/data": [{ value: 1 }],
        "root/data[0]": { value: 1 },
        "root/data[0]/value": 1,
      });
    });

    it("handles mixed objects and arrays deeply nested", () => {
      const result = flattenObject({
        obj: {
          config: {
            servers: [
              { host: "localhost", ports: [8080, 8443] },
              { host: "remote", ports: [9090] },
            ],
          },
        },
        formatIndices: true,
      });
      expect(result).toEqual({
        "config.servers[0].host": "localhost",
        "config.servers[0].ports[0]": 8080,
        "config.servers[0].ports[1]": 8443,
        "config.servers[1].host": "remote",
        "config.servers[1].ports[0]": 9090,
      });
    });
  });

  describe("edge cases", () => {
    it("handles null values as terminal values", () => {
      // Note: null is typeof "object" but should be treated as terminal
      // Looking at the implementation, null will be treated as a terminal value
      // because the check is `value && typeof value === "object"`
      expect(flattenObject({ obj: { a: null } })).toEqual({ a: null });
    });

    it("handles objects with numeric string keys", () => {
      expect(flattenObject({ obj: { "0": "zero", "1": "one" } })).toEqual({
        "0": "zero",
        "1": "one",
      });
    });

    it("handles objects with special characters in keys", () => {
      expect(
        flattenObject({ obj: { "key.with.dots": { nested: 1 } } })
      ).toEqual({
        "key.with.dots.nested": 1,
      });
    });

    it("handles empty nested objects", () => {
      expect(flattenObject({ obj: { a: {} } })).toEqual({});
    });

    it("handles empty nested objects with keepNonTerminalValues", () => {
      expect(
        flattenObject({ obj: { a: {} }, keepNonTerminalValues: true })
      ).toEqual({
        a: {},
      });
    });
  });
});

describe("jsonStringToFlatObject", () => {
  it("flattens objects", () => {
    expect(jsonStringToFlatObject("{}")).toEqual({});
    expect(jsonStringToFlatObject('{"a": 1}')).toEqual({ a: 1 });
    expect(jsonStringToFlatObject('{"a": {"b": 1}}')).toEqual({ "a.b": 1 });
    expect(jsonStringToFlatObject('{"a": {"b": {"c": 1}}}')).toEqual({
      "a.b.c": 1,
    });
    expect(jsonStringToFlatObject('{"a": {"b": 1}, "c": 2}')).toEqual({
      "a.b": 1,
      c: 2,
    });
  });
});

type SafelyJSONStringifyFixture = {
  name: string;
  input: unknown;
  expected: string | undefined;
};

const safelyJSONStringifyFixtures: SafelyJSONStringifyFixture[] = [
  // Nullish values return undefined
  {
    name: "returns undefined for null",
    input: null,
    expected: undefined,
  },
  {
    name: "returns undefined for undefined",
    input: undefined,
    expected: undefined,
  },

  // Primitive values
  {
    name: "stringifies strings",
    input: "hello",
    expected: '"hello"',
  },
  {
    name: "stringifies empty strings",
    input: "",
    expected: '""',
  },
  {
    name: "stringifies numbers",
    input: 42,
    expected: "42",
  },
  {
    name: "stringifies zero",
    input: 0,
    expected: "0",
  },
  {
    name: "stringifies negative numbers",
    input: -3.14,
    expected: "-3.14",
  },
  {
    name: "stringifies true",
    input: true,
    expected: "true",
  },
  {
    name: "stringifies false",
    input: false,
    expected: "false",
  },

  // Objects
  {
    name: "stringifies empty objects",
    input: {},
    expected: "{}",
  },
  {
    name: "stringifies simple objects",
    input: { a: 1, b: "two" },
    expected: '{"a":1,"b":"two"}',
  },
  {
    name: "stringifies nested objects",
    input: { outer: { inner: { deep: "value" } } },
    expected: '{"outer":{"inner":{"deep":"value"}}}',
  },
  {
    name: "stringifies objects with null values",
    input: { a: null, b: "value" },
    expected: '{"a":null,"b":"value"}',
  },

  // Arrays
  {
    name: "stringifies empty arrays",
    input: [],
    expected: "[]",
  },
  {
    name: "stringifies arrays of primitives",
    input: [1, 2, 3],
    expected: "[1,2,3]",
  },
  {
    name: "stringifies arrays of objects",
    input: [{ id: 1 }, { id: 2 }],
    expected: '[{"id":1},{"id":2}]',
  },
  {
    name: "stringifies mixed arrays",
    input: [1, "two", true, null, { a: 1 }],
    expected: '[1,"two",true,null,{"a":1}]',
  },

  // Edge cases that JSON.stringify handles
  {
    name: "stringifies NaN as null",
    input: NaN,
    expected: "null",
  },
  {
    name: "stringifies Infinity as null",
    input: Infinity,
    expected: "null",
  },
  {
    name: "stringifies negative Infinity as null",
    input: -Infinity,
    expected: "null",
  },
];

describe("safelyJSONStringify", () => {
  describe.each(safelyJSONStringifyFixtures)("$name", ({ input, expected }) => {
    it("stringifies correctly", () => {
      expect(safelyJSONStringify(input)).toEqual(expected);
    });
  });

  describe("error handling", () => {
    it("returns undefined for circular references", () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;
      expect(safelyJSONStringify(circular)).toBeUndefined();
    });

    it("returns undefined for BigInt values", () => {
      // BigInt cannot be serialized by JSON.stringify
      expect(safelyJSONStringify(BigInt(123))).toBeUndefined();
    });

    it("returns undefined for objects with BigInt properties", () => {
      expect(safelyJSONStringify({ value: BigInt(456) })).toBeUndefined();
    });
  });
});

type SafelyParseJSONStringFixture = {
  name: string;
  input: string;
  expected: unknown;
};

const safelyParseJSONStringFixtures: SafelyParseJSONStringFixture[] = [
  // Empty and whitespace strings return undefined
  {
    name: "returns undefined for empty string",
    input: "",
    expected: undefined,
  },
  {
    name: "returns undefined for whitespace-only string",
    input: "   ",
    expected: undefined,
  },
  {
    name: "returns undefined for tabs and newlines only",
    input: "\t\n\r",
    expected: undefined,
  },

  // Invalid JSON returns undefined
  {
    name: "returns undefined for invalid JSON",
    input: "invalid",
    expected: undefined,
  },
  {
    name: "returns undefined for unclosed brace",
    input: "{",
    expected: undefined,
  },
  {
    name: "returns undefined for malformed object",
    input: "{a: 1}",
    expected: undefined,
  },

  // Valid JSON objects
  {
    name: "parses empty object",
    input: "{}",
    expected: {},
  },
  {
    name: "parses simple object",
    input: '{"a": 1, "b": "two"}',
    expected: { a: 1, b: "two" },
  },
  {
    name: "parses nested object",
    input: '{"outer": {"inner": "value"}}',
    expected: { outer: { inner: "value" } },
  },

  // Valid JSON arrays
  {
    name: "parses empty array",
    input: "[]",
    expected: [],
  },
  {
    name: "parses array of numbers",
    input: "[1, 2, 3]",
    expected: [1, 2, 3],
  },
  {
    name: "parses array of objects",
    input: '[{"id": 1}, {"id": 2}]',
    expected: [{ id: 1 }, { id: 2 }],
  },

  // Valid JSON primitives
  {
    name: "parses number",
    input: "42",
    expected: 42,
  },
  {
    name: "parses negative number",
    input: "-3.14",
    expected: -3.14,
  },
  {
    name: "parses string",
    input: '"hello"',
    expected: "hello",
  },
  {
    name: "parses true",
    input: "true",
    expected: true,
  },
  {
    name: "parses false",
    input: "false",
    expected: false,
  },
  {
    name: "parses null",
    input: "null",
    expected: null,
  },

  // Edge cases
  {
    name: "parses JSON with leading/trailing whitespace",
    input: '  {"a": 1}  ',
    expected: { a: 1 },
  },
];

describe("safelyParseJSONString", () => {
  describe.each(safelyParseJSONStringFixtures)(
    "$name",
    ({ input, expected }) => {
      it("parses correctly", () => {
        expect(safelyParseJSONString(input)).toEqual(expected);
      });
    }
  );
});

type SafelyParseJSONObjectStringFixture = {
  name: string;
  input: string;
  expected: object | undefined;
};

const safelyParseJSONObjectStringFixtures: SafelyParseJSONObjectStringFixture[] =
  [
    // Empty and whitespace strings return undefined
    {
      name: "returns undefined for empty string",
      input: "",
      expected: undefined,
    },
    {
      name: "returns undefined for whitespace-only string",
      input: "   ",
      expected: undefined,
    },

    // Invalid JSON returns undefined
    {
      name: "returns undefined for invalid JSON",
      input: "invalid",
      expected: undefined,
    },
    {
      name: "returns undefined for malformed object",
      input: "{a: 1}",
      expected: undefined,
    },

    // Primitives return undefined (stricter than safelyParseJSONString)
    {
      name: "returns undefined for number",
      input: "42",
      expected: undefined,
    },
    {
      name: "returns undefined for string",
      input: '"hello"',
      expected: undefined,
    },
    {
      name: "returns undefined for boolean true",
      input: "true",
      expected: undefined,
    },
    {
      name: "returns undefined for boolean false",
      input: "false",
      expected: undefined,
    },
    {
      name: "returns undefined for null",
      input: "null",
      expected: undefined,
    },

    // Valid JSON objects
    {
      name: "parses empty object",
      input: "{}",
      expected: {},
    },
    {
      name: "parses simple object",
      input: '{"a": 1, "b": "two"}',
      expected: { a: 1, b: "two" },
    },
    {
      name: "parses nested object",
      input: '{"outer": {"inner": "value"}}',
      expected: { outer: { inner: "value" } },
    },
    {
      name: "parses object with null values",
      input: '{"a": null, "b": 1}',
      expected: { a: null, b: 1 },
    },

    // Valid JSON arrays (arrays are objects in JS)
    {
      name: "parses empty array",
      input: "[]",
      expected: [],
    },
    {
      name: "parses array of numbers",
      input: "[1, 2, 3]",
      expected: [1, 2, 3],
    },
    {
      name: "parses array of objects",
      input: '[{"id": 1}, {"id": 2}]',
      expected: [{ id: 1 }, { id: 2 }],
    },
    {
      name: "parses mixed array",
      input: '[1, "two", null, {"a": 1}]',
      expected: [1, "two", null, { a: 1 }],
    },

    // Edge cases
    {
      name: "parses JSON with leading/trailing whitespace",
      input: '  {"a": 1}  ',
      expected: { a: 1 },
    },
  ];

describe("safelyParseJSONObjectString", () => {
  describe.each(safelyParseJSONObjectStringFixtures)(
    "$name",
    ({ input, expected }) => {
      it("parses correctly", () => {
        expect(safelyParseJSONObjectString(input)).toEqual(expected);
      });
    }
  );
});

describe("unnestSingleStringValue", () => {
  describe("returns unnested value when object has single string key with string value", () => {
    it("unnests simple wrapped response", () => {
      const result = unnestSingleStringValue({ response: "Hello world" });
      expect(result).toEqual({ value: "Hello world", wasUnnested: true });
    });

    it("unnests with any key name", () => {
      const result = unnestSingleStringValue({ output: "Some output" });
      expect(result).toEqual({ value: "Some output", wasUnnested: true });
    });

    it("unnests empty string value", () => {
      const result = unnestSingleStringValue({ data: "" });
      expect(result).toEqual({ value: "", wasUnnested: true });
    });
  });

  describe("returns original value (wasUnnested: false) for non-unnestable values", () => {
    it("does not unnest object with multiple keys", () => {
      const input = { a: "1", b: "2" };
      const result = unnestSingleStringValue(input);
      expect(result).toEqual({ value: input, wasUnnested: false });
    });

    it("does not unnest object where value is not a string", () => {
      const input = { data: { nested: true } };
      const result = unnestSingleStringValue(input);
      expect(result).toEqual({ value: input, wasUnnested: false });
    });

    it("does not unnest object with number value", () => {
      const input = { count: 42 };
      const result = unnestSingleStringValue(input);
      expect(result).toEqual({ value: input, wasUnnested: false });
    });

    it("does not unnest object with array value", () => {
      const input = { items: ["a", "b", "c"] };
      const result = unnestSingleStringValue(input);
      expect(result).toEqual({ value: input, wasUnnested: false });
    });

    it("does not unnest object with null value", () => {
      const input = { data: null };
      const result = unnestSingleStringValue(input);
      expect(result).toEqual({ value: input, wasUnnested: false });
    });

    it("does not unnest empty object", () => {
      const input = {};
      const result = unnestSingleStringValue(input);
      expect(result).toEqual({ value: input, wasUnnested: false });
    });
  });

  describe("returns original value for non-object types", () => {
    it("returns string as-is", () => {
      const result = unnestSingleStringValue("plain string");
      expect(result).toEqual({ value: "plain string", wasUnnested: false });
    });

    it("returns number as-is", () => {
      const result = unnestSingleStringValue(42);
      expect(result).toEqual({ value: 42, wasUnnested: false });
    });

    it("returns boolean as-is", () => {
      const result = unnestSingleStringValue(true);
      expect(result).toEqual({ value: true, wasUnnested: false });
    });

    it("returns null as-is", () => {
      const result = unnestSingleStringValue(null);
      expect(result).toEqual({ value: null, wasUnnested: false });
    });

    it("returns undefined as-is", () => {
      const result = unnestSingleStringValue(undefined);
      expect(result).toEqual({ value: undefined, wasUnnested: false });
    });

    it("returns array as-is", () => {
      const input = [1, 2, 3];
      const result = unnestSingleStringValue(input);
      expect(result).toEqual({ value: input, wasUnnested: false });
    });
  });
});
