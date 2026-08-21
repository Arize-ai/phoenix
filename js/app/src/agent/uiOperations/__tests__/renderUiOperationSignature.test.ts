import { describe, expect, it } from "vitest";

import {
  getUiOperationDescriptor,
  renderUiOperationSignature,
} from "../catalog";

function renderSignature(name: string): string {
  const descriptor = getUiOperationDescriptor(name);
  if (descriptor == null) {
    throw new Error(`Operation "${name}" not in catalog`);
  }
  return renderUiOperationSignature({ descriptor, isMounted: true });
}

describe("renderUiOperationSignature output types", () => {
  it("renders a declared output schema as UiResult<T>", () => {
    const signature = renderSignature("playground.model.list");
    expect(signature).toContain("Promise<UiResult<{");
    expect(signature).toContain("builtinModels");
    expect(signature).toContain("customProviderModels");
  });

  it("keeps operations without an output schema at plain UiResult", () => {
    const signature = renderSignature("timeRange.set");
    expect(signature).toContain("Promise<UiResult>;");
  });

  it("documents the revision-bearing edit resolution", () => {
    const signature = renderSignature("playground.prompt.edit");
    expect(signature).toContain('status: "accepted" | "rejected"');
    expect(signature).toContain("revision?");
  });
});
