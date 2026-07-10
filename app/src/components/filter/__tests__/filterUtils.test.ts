import { describe, expect, it } from "vitest";

import { getDslStringLiteral, joinFilterConditions } from "../filterUtils";

describe("joinFilterConditions", () => {
  it("joins plain conditions with explicit grouping", () => {
    expect(
      joinFilterConditions({
        existingCondition: "status_code == 'ERROR'",
        nextCondition: "latency_ms > 1000",
      })
    ).toBe("(status_code == 'ERROR') and (latency_ms > 1000)");
  });

  it("preserves an existing OR expression's precedence", () => {
    expect(
      joinFilterConditions({
        existingCondition: "A or B",
        nextCondition: "C",
      })
    ).toBe("(A or B) and (C)");
  });

  it("returns the next condition when the existing condition is empty", () => {
    expect(
      joinFilterConditions({ existingCondition: "", nextCondition: "C" })
    ).toBe("C");
  });
});

describe("getDslStringLiteral", () => {
  it("escapes a single quote in a single-quoted annotation name", () => {
    expect(getDslStringLiteral({ value: "user's score", quote: "'" })).toBe(
      "'user\\'s score'"
    );
  });

  it("escapes a double quote in a double-quoted annotation label", () => {
    expect(getDslStringLiteral({ value: 'say "yes"', quote: '"' })).toBe(
      '"say \\"yes\\""'
    );
  });

  it("escapes a trailing backslash", () => {
    expect(getDslStringLiteral({ value: "path\\", quote: '"' })).toBe(
      '"path\\\\"'
    );
  });
});
