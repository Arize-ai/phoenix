import { formatJSONLError, parseJSONLKeys } from "../jsonlUtils";

describe("parseJSONLKeys", () => {
  describe("successful parsing", () => {
    it("parses simple JSONL with consistent keys", () => {
      const input = '{"a": 1, "b": 2}\n{"a": 3, "b": 4}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["a", "b"]);
      }
    });

    it("collects all unique keys across lines", () => {
      const input = '{"a": 1}\n{"b": 2}\n{"c": 3}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["a", "b", "c"]);
      }
    });

    it("handles objects with different keys per line", () => {
      const input =
        '{"name": "Alice", "age": 30}\n{"name": "Bob", "city": "NYC"}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["age", "city", "name"]);
      }
    });

    it("handles BOM at start of file", () => {
      const input = '\uFEFF{"a": 1}\n{"b": 2}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["a", "b"]);
      }
    });

    it("handles Windows line endings", () => {
      const input = '{"a": 1}\r\n{"b": 2}\r\n{"c": 3}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["a", "b", "c"]);
      }
    });

    it("ignores empty lines", () => {
      const input = '{"a": 1}\n\n{"b": 2}\n   \n{"c": 3}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["a", "b", "c"]);
      }
    });

    it("handles single line JSONL", () => {
      const input = '{"name": "test", "value": 42}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["name", "value"]);
      }
    });

    it("handles nested objects (only extracts top-level keys)", () => {
      const input = '{"outer": {"inner": 1}, "flat": 2}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.keys.sort()).toEqual(["flat", "outer"]);
      }
    });
  });

  describe("error handling", () => {
    it("returns error for empty file", () => {
      const result = parseJSONLKeys("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("JSONL file is empty");
        expect(result.error.line).toBe(0);
      }
    });

    it("returns error for file with only whitespace", () => {
      const result = parseJSONLKeys("   \n\n   ");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("JSONL file is empty");
      }
    });

    it("returns error with line number for invalid JSON", () => {
      const input = '{"a": 1}\n{invalid json}\n{"c": 3}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(2);
        expect(result.error.message).toContain("Invalid JSON");
      }
    });

    it("returns error for array instead of object", () => {
      const input = '{"a": 1}\n[1, 2, 3]\n{"c": 3}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(2);
        expect(result.error.message).toContain("Expected a JSON object");
        expect(result.error.message).toContain("array");
      }
    });

    it("returns error for primitive values", () => {
      const input = '{"a": 1}\n42\n{"c": 3}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(2);
        expect(result.error.message).toContain("Expected a JSON object");
        expect(result.error.message).toContain("number");
      }
    });

    it("returns error for string values", () => {
      const input = '{"a": 1}\n"just a string"\n{"c": 3}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(2);
        expect(result.error.message).toContain("Expected a JSON object");
        expect(result.error.message).toContain("string");
      }
    });

    it("returns error for null", () => {
      const input = '{"a": 1}\nnull\n{"c": 3}';
      const result = parseJSONLKeys(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBe(2);
        expect(result.error.message).toContain("Expected a JSON object");
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
