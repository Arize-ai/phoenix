import {
  compressObject,
  extractPathsFromDatasetExamples,
  extractPathsFromObject,
} from "../objectUtils";

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

describe("extractPathsFromObject", () => {
  it("extracts top-level keys", () => {
    const result = extractPathsFromObject({ name: "Alice", age: 30 });
    expect(result).toEqual(["name", "age"]);
  });

  it("extracts nested paths with dot notation", () => {
    const result = extractPathsFromObject({
      user: { name: "Alice", email: "alice@example.com" },
    });
    expect(result).toContain("user");
    expect(result).toContain("user.name");
    expect(result).toContain("user.email");
  });

  it("extracts deeply nested paths", () => {
    const result = extractPathsFromObject({
      user: { address: { city: "NYC" } },
    });
    expect(result).toContain("user");
    expect(result).toContain("user.address");
    expect(result).toContain("user.address.city");
  });

  it("extracts array indices", () => {
    const result = extractPathsFromObject({ items: ["a", "b", "c"] });
    expect(result).toContain("items");
    expect(result).toContain("items[0]");
    expect(result).toContain("items[1]");
    expect(result).toContain("items[2]");
  });

  it("extracts paths from objects inside arrays", () => {
    const result = extractPathsFromObject({
      users: [{ name: "Alice" }, { name: "Bob" }],
    });
    expect(result).toContain("users");
    expect(result).toContain("users[0]");
    expect(result).toContain("users[0].name");
    expect(result).toContain("users[1]");
    expect(result).toContain("users[1].name");
  });

  it("handles empty objects", () => {
    const result = extractPathsFromObject({});
    expect(result).toEqual([]);
  });

  it("handles non-objects", () => {
    const result = extractPathsFromObject("string");
    expect(result).toEqual([]);
  });

  it("respects maxDepth", () => {
    const result = extractPathsFromObject(
      { a: { b: { c: { d: "deep" } } } },
      "",
      2
    );
    expect(result).toContain("a");
    expect(result).toContain("a.b");
    // Should stop at depth 2
    expect(result).not.toContain("a.b.c.d");
  });
});

describe("extractPathsFromDatasetExamples", () => {
  it("extracts paths from dataset examples with input/reference/metadata context when no path specified", () => {
    const examples = [
      {
        input: { query: "hello" },
        reference: { label: "greeting" },
        metadata: { source: "test" },
        taskOutput: { label: "greeting" },
      },
    ];
    const result = extractPathsFromDatasetExamples(examples, null);
    // Should have input, reference (from output), output (from taskOutput), and metadata
    expect(result).toContain("input");
    expect(result).toContain("input.query");
    expect(result).toContain("reference");
    expect(result).toContain("reference.label");
    expect(result).toContain("metadata");
    expect(result).toContain("metadata.source");
    expect(result).toContain("output");
    expect(result).toContain("output.label");
  });

  it("scopes paths to input when templateVariablesPath is 'input'", () => {
    const examples = [
      {
        input: { query: "hello", context: { text: "world" } },
        reference: { label: "greeting" },
        metadata: { source: "test" },
      },
    ];
    const result = extractPathsFromDatasetExamples(examples, "input");
    // Should only have paths relative to input
    expect(result).toContain("query");
    expect(result).toContain("context");
    expect(result).toContain("context.text");
    // Should NOT have input, reference, or metadata as top-level
    expect(result).not.toContain("input");
    expect(result).not.toContain("reference");
    expect(result).not.toContain("metadata");
  });

  it("scopes paths to reference when templateVariablesPath is 'reference'", () => {
    const examples = [
      {
        input: { query: "hello" },
        reference: { label: "greeting", score: 0.9 },
        metadata: { source: "test" },
      },
    ];
    const result = extractPathsFromDatasetExamples(examples, "reference");
    // Should only have paths relative to reference (output)
    expect(result).toContain("label");
    expect(result).toContain("score");
    expect(result).not.toContain("input");
    expect(result).not.toContain("reference");
  });

  it("merges paths from multiple examples", () => {
    const examples = [
      { input: { a: 1 }, reference: {}, metadata: {} },
      { input: { b: 2 }, reference: {}, metadata: {} },
    ];
    const result = extractPathsFromDatasetExamples(examples, null);
    expect(result).toContain("input.a");
    expect(result).toContain("input.b");
  });

  it("deduplicates paths", () => {
    const examples = [
      { input: { query: "a" }, reference: {}, metadata: {} },
      { input: { query: "b" }, reference: {}, metadata: {} },
    ];
    const result = extractPathsFromDatasetExamples(examples, null);
    const queryCount = result.filter((p) => p === "input.query").length;
    expect(queryCount).toBe(1);
  });

  it("respects maxExamples limit", () => {
    const examples = Array.from({ length: 100 }, (_, i) => ({
      input: { [`field${i}`]: i },
      reference: {},
      metadata: {},
    }));
    const result = extractPathsFromDatasetExamples(examples, null, 5);
    // Should only have fields from first 5 examples
    expect(result).toContain("input.field0");
    expect(result).toContain("input.field4");
    expect(result).not.toContain("input.field5");
  });

  it("returns sorted paths", () => {
    const examples = [
      { input: { z: 1, a: 2, m: 3 }, reference: {}, metadata: {} },
    ];
    const result = extractPathsFromDatasetExamples(examples, null);
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });

  it("handles empty examples array", () => {
    const result = extractPathsFromDatasetExamples([], null);
    expect(result).toEqual([]);
  });

  it("handles nested templateVariablesPath like 'input.nested'", () => {
    const examples = [
      {
        input: { nested: { foo: "bar", baz: 123 } },
        reference: {},
        metadata: {},
      },
    ];
    const result = extractPathsFromDatasetExamples(examples, "input.nested");
    expect(result).toContain("foo");
    expect(result).toContain("baz");
    expect(result).not.toContain("input");
    expect(result).not.toContain("nested");
  });

  it("extracts deeply nested paths with arrays for Example root", () => {
    // This matches the user's actual data structure where example.input has nested input keys
    const examples = [
      {
        input: {
          input: {
            input: {
              messages: [{ role: "user", content: "Hello" }],
            },
          },
        },
        reference: {},
        metadata: {},
      },
    ];
    const result = extractPathsFromDatasetExamples(examples, null);
    // Should include full paths including bracket notation
    expect(result).toContain("input");
    expect(result).toContain("input.input");
    expect(result).toContain("input.input.input");
    expect(result).toContain("input.input.input.messages");
    expect(result).toContain("input.input.input.messages[0]");
    expect(result).toContain("input.input.input.messages[0].role");
    expect(result).toContain("input.input.input.messages[0].content");
  });
});
