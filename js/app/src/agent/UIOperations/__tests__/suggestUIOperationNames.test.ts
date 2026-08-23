import { describe, expect, it } from "vitest";

import { suggestUIOperationNames } from "../catalog";

// Both cases below are lifted verbatim from PXI field reports: model-issued
// typos whose old namespace-dump suggestions buried or missed the target.
describe("suggestUIOperationNames", () => {
  it("ranks a one-edit typo's target first even without its namespace", () => {
    // `prompt.readt` is one edit from the `prompt.read` suffix of
    // `playground.prompt.read`.
    expect(suggestUIOperationNames("prompt.readt")[0]).toBe(
      "playground.prompt.read"
    );
  });

  it("suggests within the named namespace, not a cross-namespace verb match", () => {
    // `evaluators.code.cancel` doesn't exist; suggestions should lead with
    // evaluators.code.* operations, not playground.run.cancel.
    const suggestions = suggestUIOperationNames("evaluators.code.cancel");
    expect(suggestions[0]).toMatch(/^evaluators\.code\./);
  });

  it("caps suggestions at five", () => {
    expect(
      suggestUIOperationNames("nonexistent.operation").length
    ).toBeLessThanOrEqual(5);
  });
});
