import { describe, expect, it } from "vitest";

import {
  getDslStringLiteral,
  joinFilterConditions,
} from "../filterConditionUtils";

describe("joinFilterConditions", () => {
  it("groups both sides so an existing OR keeps its precedence", () => {
    expect(
      joinFilterConditions({
        existingCondition: "status_code == 'ERROR' or latency_ms > 1000",
        nextCondition: "name == 'chat'",
      })
    ).toBe(
      "(status_code == 'ERROR' or latency_ms > 1000) and (name == 'chat')"
    );
  });

  it("returns the next condition when the existing condition is empty", () => {
    expect(
      joinFilterConditions({ existingCondition: "", nextCondition: "C" })
    ).toBe("C");
  });
});

describe("getDslStringLiteral", () => {
  it("escapes backslashes and the enclosing quote", () => {
    expect(getDslStringLiteral({ value: "user's path\\", quote: "'" })).toBe(
      "'user\\'s path\\\\'"
    );
  });

  it("escapes newlines, which would otherwise leave the literal unterminated", () => {
    expect(getDslStringLiteral({ value: "a\nb\r\nc", quote: "'" })).toBe(
      "'a\\nb\\r\\nc'"
    );
  });

  it("escapes the remaining control characters", () => {
    expect(
      getDslStringLiteral({
        value: "a\tb\u0000c\u001Bd\u007Fe",
        quote: '"',
      })
    ).toBe('"a\\tb\\x00c\\x1bd\\x7fe"');
  });
});
