import { compressObject, getRootKey, getValueAtPath } from "../objectUtils";

type CompressObjectFixture = {
  name: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown> | undefined;
};

const compressObjectFixtures: CompressObjectFixture[] = [
  // Null and undefined removal
  {
    name: "removes null values",
    input: { a: null, b: "value" },
    expected: { b: "value" },
  },
  {
    name: "removes undefined values",
    input: { a: undefined, b: "value" },
    expected: { b: "value" },
  },
  {
    name: "removes both null and undefined values",
    input: { a: null, b: undefined, c: "value" },
    expected: { c: "value" },
  },

  // Empty string removal
  {
    name: "removes empty strings",
    input: { a: "", b: "value" },
    expected: { b: "value" },
  },
  {
    name: "keeps non-empty strings",
    input: { a: "hello", b: "world" },
    expected: { a: "hello", b: "world" },
  },
  {
    name: "keeps whitespace-only strings",
    input: { a: "  ", b: "value" },
    expected: { a: "  ", b: "value" },
  },

  // Empty object removal
  {
    name: "removes empty objects",
    input: { a: {}, b: "value" },
    expected: { b: "value" },
  },
  {
    name: "keeps non-empty objects",
    input: { a: { nested: "value" }, b: "value" },
    expected: { a: { nested: "value" }, b: "value" },
  },
  {
    name: "keeps objects with falsy but defined values",
    input: { a: { nested: 0 }, b: "value" },
    expected: { a: { nested: 0 }, b: "value" },
  },

  // Empty array removal
  {
    name: "removes empty arrays",
    input: { a: [], b: "value" },
    expected: { b: "value" },
  },
  {
    name: "keeps non-empty arrays",
    input: { a: [1, 2, 3], b: "value" },
    expected: { a: [1, 2, 3], b: "value" },
  },
  {
    name: "keeps arrays with falsy values",
    input: { a: [0, "", null], b: "value" },
    expected: { a: [0, "", null], b: "value" },
  },

  // Primitive value preservation
  {
    name: "keeps zero values",
    input: { a: 0, b: "value" },
    expected: { a: 0, b: "value" },
  },
  {
    name: "keeps false boolean values",
    input: { a: false, b: "value" },
    expected: { a: false, b: "value" },
  },
  {
    name: "keeps true boolean values",
    input: { a: true, b: "value" },
    expected: { a: true, b: "value" },
  },
  {
    name: "keeps positive numbers",
    input: { a: 42, b: 3.14 },
    expected: { a: 42, b: 3.14 },
  },
  {
    name: "keeps negative numbers",
    input: { a: -1, b: -0.5 },
    expected: { a: -1, b: -0.5 },
  },

  // Returning undefined for fully empty results
  {
    name: "returns undefined for object with only null values",
    input: { a: null, b: null },
    expected: undefined,
  },
  {
    name: "returns undefined for object with only undefined values",
    input: { a: undefined, b: undefined },
    expected: undefined,
  },
  {
    name: "returns undefined for object with only empty strings",
    input: { a: "", b: "" },
    expected: undefined,
  },
  {
    name: "returns undefined for object with only empty objects",
    input: { a: {}, b: {} },
    expected: undefined,
  },
  {
    name: "returns undefined for object with only empty arrays",
    input: { a: [], b: [] },
    expected: undefined,
  },
  {
    name: "returns undefined for empty input object",
    input: {},
    expected: undefined,
  },
  {
    name: "returns undefined for mixed empty values",
    input: { a: null, b: undefined, c: "", d: {}, e: [] },
    expected: undefined,
  },

  // Complex nested structures
  {
    name: "preserves deeply nested objects",
    input: { a: { b: { c: { d: "deep" } } }, e: null },
    expected: { a: { b: { c: { d: "deep" } } } },
  },
  {
    name: "preserves arrays of objects",
    input: { items: [{ id: 1 }, { id: 2 }], empty: [] },
    expected: { items: [{ id: 1 }, { id: 2 }] },
  },
  {
    name: "handles mixed valid and invalid values",
    input: {
      name: "test",
      description: "",
      count: 0,
      enabled: false,
      tags: [],
      metadata: {},
      config: { key: "value" },
      items: [1, 2],
      nothing: null,
    },
    expected: {
      name: "test",
      count: 0,
      enabled: false,
      config: { key: "value" },
      items: [1, 2],
    },
  },

  // Edge cases with special values
  {
    name: "keeps NaN values",
    input: { a: NaN, b: "value" },
    expected: { a: NaN, b: "value" },
  },
  {
    name: "keeps Infinity values",
    input: { a: Infinity, b: -Infinity },
    expected: { a: Infinity, b: -Infinity },
  },
  {
    name: "removes Date objects (treated as empty objects since they have no enumerable keys)",
    input: { a: new Date("2024-01-01"), b: "value" },
    expected: { b: "value" },
  },

  // GraphQL mutation input scenarios
  {
    name: "compresses typical GraphQL mutation input with optional fields",
    input: {
      id: "123",
      name: "Updated Name",
      description: undefined,
      maxTokens: null,
      temperature: 0.7,
      tools: [],
      metadata: {},
    },
    expected: {
      id: "123",
      name: "Updated Name",
      temperature: 0.7,
    },
  },
  {
    name: "preserves all fields when all are valid",
    input: {
      id: "456",
      name: "Full Object",
      description: "A description",
      maxTokens: 1000,
      temperature: 0.5,
      tools: ["tool1"],
      metadata: { key: "value" },
    },
    expected: {
      id: "456",
      name: "Full Object",
      description: "A description",
      maxTokens: 1000,
      temperature: 0.5,
      tools: ["tool1"],
      metadata: { key: "value" },
    },
  },
];

describe("compressObject", () => {
  describe.each(compressObjectFixtures)("$name", ({ input, expected }) => {
    it("compresses correctly", () => {
      const result = compressObject(input);
      if (expected === undefined) {
        expect(result).toBeUndefined();
      } else {
        expect(result).toEqual(expected);
      }
    });
  });

  // Additional behavioral tests
  describe("behavioral guarantees", () => {
    it("does not mutate the original object", () => {
      const original = { a: "value", b: null, c: "" };
      const originalCopy = { ...original };
      compressObject(original);
      expect(original).toEqual(originalCopy);
    });

    it("returns a new object reference", () => {
      const input = { a: "value" };
      const result = compressObject(input);
      expect(result).not.toBe(input);
    });

    it("does not recursively compress nested objects", () => {
      // Note: compressObject only removes empty values at the top level
      // Nested empty values inside objects are preserved
      const input = { outer: { inner: null, empty: "" } };
      const result = compressObject(input);
      expect(result).toEqual({ outer: { inner: null, empty: "" } });
    });
  });
});

describe("getValueAtPath", () => {
  describe("simple key access", () => {
    it("returns value for simple key", () => {
      expect(getValueAtPath({ name: "Alice" }, "name")).toBe("Alice");
    });

    it("returns undefined for missing key", () => {
      expect(getValueAtPath({ name: "Alice" }, "email")).toBeUndefined();
    });

    it("returns the object itself for empty path", () => {
      const obj = { name: "Alice" };
      expect(getValueAtPath(obj, "")).toBe(obj);
    });
  });

  describe("dot notation", () => {
    it("accesses nested properties", () => {
      expect(getValueAtPath({ user: { name: "Alice" } }, "user.name")).toBe(
        "Alice"
      );
    });

    it("accesses deeply nested properties", () => {
      expect(
        getValueAtPath({ a: { b: { c: { d: "deep" } } } }, "a.b.c.d")
      ).toBe("deep");
    });

    it("returns undefined for missing nested key", () => {
      expect(
        getValueAtPath({ user: { name: "Alice" } }, "user.email")
      ).toBeUndefined();
    });

    it("returns undefined when traversing through non-object", () => {
      expect(getValueAtPath({ user: "Alice" }, "user.name")).toBeUndefined();
    });
  });

  describe("array indexing", () => {
    it("accesses array elements by index", () => {
      expect(getValueAtPath({ items: ["a", "b", "c"] }, "items[0]")).toBe("a");
      expect(getValueAtPath({ items: ["a", "b", "c"] }, "items[2]")).toBe("c");
    });

    it("returns undefined for out of bounds index", () => {
      expect(
        getValueAtPath({ items: ["a", "b", "c"] }, "items[10]")
      ).toBeUndefined();
    });

    it("returns undefined when using array index on non-array", () => {
      expect(
        getValueAtPath({ items: "not-array" }, "items[0]")
      ).toBeUndefined();
    });

    it("handles negative indices (JavaScript behavior)", () => {
      // JavaScript arrays with negative indices return undefined
      expect(
        getValueAtPath({ items: ["a", "b", "c"] }, "items[-1]")
      ).toBeUndefined();
    });
  });

  describe("combined dot notation and array indexing", () => {
    it("accesses nested array element properties", () => {
      const obj = { messages: [{ role: "user", content: "Hello" }] };
      expect(getValueAtPath(obj, "messages[0].content")).toBe("Hello");
    });

    it("accesses array in nested object", () => {
      const obj = { input: { messages: ["Hello", "World"] } };
      expect(getValueAtPath(obj, "input.messages[0]")).toBe("Hello");
    });

    it("handles complex paths", () => {
      const obj = {
        input: {
          messages: [{ role: "user", content: "Show database schema" }],
        },
      };
      expect(getValueAtPath(obj, "input.messages[0].content")).toBe(
        "Show database schema"
      );
    });

    it("handles multiple array indices", () => {
      const obj = {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
      };
      expect(getValueAtPath(obj, "data[0][1]")).toBe("b");
      expect(getValueAtPath(obj, "data[1][2]")).toBe("f");
    });

    it("handles alternating dot and array access", () => {
      const obj = {
        users: [{ addresses: [{ city: "NYC" }, { city: "LA" }] }],
      };
      expect(getValueAtPath(obj, "users[0].addresses[1].city")).toBe("LA");
    });
  });

  describe("edge cases", () => {
    it("returns undefined for null in path", () => {
      expect(getValueAtPath({ user: null }, "user.name")).toBeUndefined();
    });

    it("returns null value correctly", () => {
      expect(getValueAtPath({ value: null }, "value")).toBeNull();
    });

    it("returns undefined for malformed bracket syntax", () => {
      expect(getValueAtPath({ items: ["a", "b"] }, "items[")).toBeUndefined();
    });

    it("handles empty array", () => {
      expect(getValueAtPath({ items: [] }, "items[0]")).toBeUndefined();
    });
  });
});

describe("getRootKey", () => {
  it("returns the key itself for simple key", () => {
    expect(getRootKey("input")).toBe("input");
    expect(getRootKey("name")).toBe("name");
  });

  it("extracts root from dot notation path", () => {
    expect(getRootKey("input.query")).toBe("input");
    expect(getRootKey("user.profile.name")).toBe("user");
  });

  it("extracts root from array index path", () => {
    expect(getRootKey("messages[0]")).toBe("messages");
    expect(getRootKey("items[0][1]")).toBe("items");
  });

  it("extracts root from combined path", () => {
    expect(getRootKey("input.messages[0].content")).toBe("input");
    expect(getRootKey("users[0].addresses[1].city")).toBe("users");
  });

  it("handles dot before bracket", () => {
    expect(getRootKey("input.items[0]")).toBe("input");
  });

  it("handles bracket before dot", () => {
    expect(getRootKey("items[0].name")).toBe("items");
  });
});
