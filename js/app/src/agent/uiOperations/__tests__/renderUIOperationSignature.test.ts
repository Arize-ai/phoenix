import { describe, expect, it } from "vitest";

import {
  getUIOperationDescriptor,
  renderUIOperationSignature,
} from "../catalog";

function renderSignature(name: string): string {
  const descriptor = getUIOperationDescriptor(name);
  if (descriptor == null) {
    throw new Error(`Operation "${name}" not in catalog`);
  }
  return renderUIOperationSignature({ descriptor, isMounted: true });
}

describe("renderUIOperationSignature output types", () => {
  it("renders a declared output schema as UIResult<T>", () => {
    const signature = renderSignature("playground.model.list");
    expect(signature).toContain("Promise<UIResult<{");
    expect(signature).toContain("builtinModels");
    expect(signature).toContain("customProviderModels");
  });

  it("keeps operations without an output schema at plain UIResult", () => {
    const signature = renderSignature("timeRange.set");
    expect(signature).toContain("Promise<UIResult>;");
  });

  it("documents the revision-bearing edit resolution", () => {
    const signature = renderSignature("playground.prompt.edit");
    expect(signature).toContain('status: "accepted" | "rejected"');
    expect(signature).toContain("revision?");
  });
});
