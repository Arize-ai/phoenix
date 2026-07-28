import { describe, expect, it } from "vitest";

import { getDslStringLiteral, joinFilterConditions } from "../filterUtils";

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
});
