import { describe, expect, it } from "vitest";

import {
  fitColumnsToWidth,
  formatTable,
  truncateCell,
} from "../src/commands/formatTable";

describe("formatTable", () => {
  it("returns an empty string for an empty array", () => {
    expect(formatTable([])).toBe("");
  });

  it("renders a simple table without truncation", () => {
    const result = formatTable(
      [
        { name: "alice", age: 30 },
        { name: "bob", age: 25 },
      ],
      { maxWidth: 120 }
    );
    expect(result).toContain("alice");
    expect(result).toContain("bob");
  });

  it("uppercases headers", () => {
    const result = formatTable(
      [{ name: "alice", age: 30 }],
      { maxWidth: 120 }
    );
    expect(result).toContain("NAME");
    expect(result).toContain("AGE");
    // Original casing should not appear as a header
    const lines = result.split("\n");
    expect(lines[0]).toBe("NAME   AGE");
    // Second line should be the separator
    expect(lines[1]).toBe("─────  ───");
  });

  it("does not contain box-drawing border characters (except ─ in separator)", () => {
    const result = formatTable(
      [{ name: "alice", age: 30 }],
      { maxWidth: 120 }
    );
    for (const ch of ["┌", "┐", "└", "┘", "├", "┤", "┬", "┴", "┼", "│"]) {
      expect(result).not.toContain(ch);
    }
  });

  it("renders a separator line matching column widths", () => {
    const result = formatTable(
      [
        { name: "default", description: "Default project", id: "UHJvamVjdDox" },
        { name: "SESSIONS-DEMO", description: "", id: "UHJvamVjdDo1" },
      ],
      { maxWidth: 200 }
    );
    const lines = result.split("\n");
    const separator = lines[1]!;
    // Separator should only contain ─ and spaces
    expect(separator).toMatch(/^[─ ]+$/);
    // Each column segment should match the header column width
    const headerParts = lines[0]!.match(/\S+(\s+|$)/g)!;
    const sepParts = separator.split("  ");
    expect(sepParts.length).toBe(headerParts.length);
    for (const part of sepParts) {
      // Each segment is all ─
      expect(part).toMatch(/^─+$/);
    }
  });

  it("truncates wide columns to fit within maxWidth", () => {
    const longName = "a".repeat(100);
    const result = formatTable([{ name: longName, id: "1" }], { maxWidth: 40 });
    // The table should not exceed maxWidth on any line
    for (const line of result.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
    // Should contain an ellipsis since the name was truncated
    expect(result).toContain("…");
  });

  it("handles multiple columns that all need truncation", () => {
    const result = formatTable(
      [
        {
          first: "x".repeat(50),
          second: "y".repeat(50),
          third: "z".repeat(50),
        },
      ],
      { maxWidth: 40 }
    );
    for (const line of result.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it("does not truncate when table fits within maxWidth", () => {
    const result = formatTable([{ name: "short", id: "1" }], { maxWidth: 200 });
    expect(result).not.toContain("…");
    expect(result).toContain("short");
  });
});

describe("fitColumnsToWidth", () => {
  it("returns natural widths when table fits", () => {
    const result = fitColumnsToWidth({
      naturalWidths: [5, 3],
      terminalWidth: 200,
    });
    expect(result).toEqual([5, 3]);
  });

  it("shrinks the widest column first", () => {
    // 2 columns: overhead = 2 * (2 - 1) = 2
    // natural widths [20, 5] → total = 20 + 5 + 2 = 27
    // target = 20 → need to shrink by 7, all from the wide column
    const result = fitColumnsToWidth({
      naturalWidths: [20, 5],
      terminalWidth: 20,
    });
    expect(result).toEqual([13, 5]);
    // Verify: 13 + 5 + 2 = 20
  });

  it("stops shrinking at MIN_COL_WIDTH", () => {
    const result = fitColumnsToWidth({
      naturalWidths: [10, 10],
      terminalWidth: 5, // impossibly small
    });
    // Both should be at minimum (4)
    expect(result).toEqual([4, 4]);
  });
});

describe("truncateCell", () => {
  it("pads short values", () => {
    expect(truncateCell("hi", 6)).toBe("hi    ");
  });

  it("returns exact-length values unchanged", () => {
    expect(truncateCell("hello", 5)).toBe("hello");
  });

  it("truncates long values with ellipsis", () => {
    expect(truncateCell("hello world", 7)).toBe("hello …");
  });

  it("handles width of 1", () => {
    expect(truncateCell("hello", 1)).toBe("…");
  });
});
