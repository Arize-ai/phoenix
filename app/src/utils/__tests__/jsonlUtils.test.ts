import { formatJSONLError, parseJSONLKeys } from "../jsonlUtils";

/**
 * Helper to create a File object from a string for testing streaming functions.
 * Includes a polyfill for File.stream() which is not available in all test environments.
 */
function createFile(content: string, name = "test.jsonl"): File {
  const file = new File([content], name, { type: "application/jsonl" });

  // Polyfill stream() for test environment
  if (!file.stream) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    (file as { stream: () => ReadableStream<Uint8Array> }).stream = () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });
  }

  return file;
}

describe("parseJSONLKeys", () => {
  describe("successful parsing", () => {
    it("parses simple JSONL with consistent keys", async () => {
      const file = createFile('{"a": 1, "b": 2}\n{"a": 3, "b": 4}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["a", "b"]);
      }
    });

    it("collects all unique keys across lines", async () => {
      const file = createFile('{"a": 1}\n{"b": 2}\n{"c": 3}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["a", "b", "c"]);
      }
    });

    it("handles objects with different keys per line", async () => {
      const file = createFile(
        '{"name": "Alice", "age": 30}\n{"name": "Bob", "city": "NYC"}'
      );
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["age", "city", "name"]);
      }
    });

    it("handles BOM at start of file", async () => {
      const file = createFile('\uFEFF{"a": 1}\n{"b": 2}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["a", "b"]);
      }
    });

    it("handles Windows line endings", async () => {
      const file = createFile('{"a": 1}\r\n{"b": 2}\r\n{"c": 3}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["a", "b", "c"]);
      }
    });

    it("ignores empty lines", async () => {
      const file = createFile('{"a": 1}\n\n{"b": 2}\n   \n{"c": 3}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["a", "b", "c"]);
      }
    });

    it("handles single line JSONL", async () => {
      const file = createFile('{"name": "test", "value": 42}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["name", "value"]);
      }
    });

    it("handles nested objects (only extracts top-level keys)", async () => {
      const file = createFile('{"outer": {"inner": 1}, "flat": 2}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["flat", "outer"]);
      }
    });

    it("only parses first N rows by default", async () => {
      // Create file with 20 rows, each with a unique key
      const lines = Array.from({ length: 20 }, (_, i) => `{"key${i}": ${i}}`);
      const file = createFile(lines.join("\n"));
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(true);
      if (result.success) {
        // Default maxRows is 10, so we should only see keys 0-9
        expect(result.keys.length).toBe(10);
        expect(result.keys).toContain("key0");
        expect(result.keys).toContain("key9");
        expect(result.keys).not.toContain("key10");
      }
    });

    it("respects custom maxRows parameter", async () => {
      const lines = Array.from({ length: 20 }, (_, i) => `{"key${i}": ${i}}`);
      const file = createFile(lines.join("\n"));
      const result = await parseJSONLKeys(file, 5);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.length).toBe(5);
        expect(result.keys).toContain("key0");
        expect(result.keys).toContain("key4");
        expect(result.keys).not.toContain("key5");
      }
    });
  });

  describe("error handling", () => {
    it("returns error for empty file", async () => {
      const file = createFile("");
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("JSONL file is empty");
        expect(result.error.line).toBe(0);
      }
    });

    it("returns error for file with only whitespace", async () => {
      const file = createFile("   \n\n   ");
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("JSONL file is empty");
      }
    });

    it("returns error with line number for invalid JSON", async () => {
      const file = createFile('{"a": 1}\n{invalid json}\n{"c": 3}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(2);
        expect(result.error.message).toContain("Invalid JSON");
      }
    });

    it("returns error for array instead of object", async () => {
      const file = createFile('{"a": 1}\n[1, 2, 3]\n{"c": 3}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(2);
        expect(result.error.message).toContain("Expected a JSON object");
        expect(result.error.message).toContain("array");
      }
    });

    it("returns error for primitive values", async () => {
      const file = createFile('{"a": 1}\n42\n{"c": 3}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(2);
        expect(result.error.message).toContain("Expected a JSON object");
        expect(result.error.message).toContain("number");
      }
    });

    it("returns error for string values", async () => {
      const file = createFile('{"a": 1}\n"just a string"\n{"c": 3}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(2);
        expect(result.error.message).toContain("Expected a JSON object");
        expect(result.error.message).toContain("string");
      }
    });

    it("returns error for null with correct type in message", async () => {
      const file = createFile('{"a": 1}\nnull\n{"c": 3}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(2);
        expect(result.error.message).toContain("Expected a JSON object");
        expect(result.error.message).toContain("null");
      }
    });

    it("returns correct line number when blank lines precede error", async () => {
      // Blank line on line 2, error on line 3
      const file = createFile('{"a": 1}\n\n{invalid json}');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(3); // Line 3, not 2
        expect(result.error.message).toContain("Invalid JSON");
      }
    });

    it("returns correct line number with multiple blank lines", async () => {
      // Valid on line 1, blank on 2-3, error on line 4
      const file = createFile('{"a": 1}\n\n\nnull');
      const result = await parseJSONLKeys(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(4); // Line 4, not 2
        expect(result.error.message).toContain("null");
      }
    });
  });
});

describe("formatJSONLError", () => {
  it("formats error with line number", () => {
    expect(formatJSONLError({ line: 5, message: "Invalid JSON" })).toBe(
      "Line 5: Invalid JSON"
    );
  });

  it("formats error without line number for line 0", () => {
    expect(formatJSONLError({ line: 0, message: "JSONL file is empty" })).toBe(
      "JSONL file is empty"
    );
  });
});
