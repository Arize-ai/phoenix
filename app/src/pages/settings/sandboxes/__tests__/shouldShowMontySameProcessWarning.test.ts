import { describe, expect, it } from "vitest";

import { shouldShowMontySameProcessWarning } from "../utils";

describe("shouldShowMontySameProcessWarning", () => {
  it("returns true for an available Monty backend", () => {
    expect(
      shouldShowMontySameProcessWarning({
        backendType: "MONTY",
        status: "AVAILABLE",
      })
    ).toBe(true);
  });
});
