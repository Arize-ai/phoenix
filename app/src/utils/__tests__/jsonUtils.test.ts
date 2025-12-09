import {
  isJSONObjectString,
  jsonStringToFlatObject,
  safelyJSONStringify,
  safelyParseJSONObjectString,
  safelyParseJSONString,
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
