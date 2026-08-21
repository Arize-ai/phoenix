import { describe, expect, it } from "vitest";

import { createUIProxy } from "@phoenix/agent/UIOperations/runtime/UIScriptWorker";

const CATALOG = [
  "timeRange.set",
  "playground.prompt.read",
  "playground.prompt.edit",
  "playground.run",
  "playground.run.cancel",
];

interface AnyRecord {
  [key: string]: AnyRecord;
}

function proxy(): AnyRecord {
  return createUIProxy(CATALOG) as AnyRecord;
}

// A PXI field report demonstrated the pre-catalog proxy actively lying to
// feature detection: `typeof ui.has === "function"` for a helper that did
// not exist, while `'has' in ui` was false. Introspection now answers from
// the catalog; property access stays permissive so unknown-name calls still
// reach dispatch's did-you-mean error.
describe("createUIProxy introspection", () => {
  it("answers `in` truthfully from the catalog", () => {
    const ui = proxy();
    expect("playground" in ui).toBe(true);
    expect("prompt" in ui.playground).toBe(true);
    expect("has" in ui).toBe(false);
    expect("nonexistent" in ui.playground).toBe(false);
  });

  it("enumerates real operations only", () => {
    const ui = proxy();
    expect(Object.keys(ui).sort()).toEqual(["playground", "timeRange"]);
    expect(Object.keys(ui.playground).sort()).toEqual(["prompt", "run"]);
    // `run` is both a callable op and a namespace; its children enumerate.
    expect(Object.keys(ui.playground.run)).toEqual(["cancel"]);
    // Leaf operations have no children.
    expect(Object.keys(ui.timeRange.set)).toEqual([]);
  });

  it("keeps property access permissive so dispatch can suggest near-misses", () => {
    const ui = proxy();
    // Unknown paths still terminate in a callable — the detection contract
    // is `in`/`Object.keys`, never `typeof`.
    expect(typeof ui.not.a.real.operation).toBe("function");
  });
});
