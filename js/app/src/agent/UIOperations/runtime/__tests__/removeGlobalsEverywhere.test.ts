import { describe, expect, it } from "vitest";

import { removeGlobalsEverywhere } from "@phoenix/agent/UIOperations/runtime/UIScriptWorker";

describe("removeGlobalsEverywhere", () => {
  it("deletes prototype-chain members and shadows the global", () => {
    const proto = Object.getPrototypeOf(globalThis) as Record<string, unknown>;
    const name = "__pxiTestBlockedGlobal__";
    proto[name] = "prototype-value"; // simulates WorkerGlobalScope.prototype.fetch
    try {
      removeGlobalsEverywhere([name]);

      // gone from the prototype — prototype-walking recovery finds nothing
      expect(Object.prototype.hasOwnProperty.call(proto, name)).toBe(false);
      // shadowed on the global itself
      const own = Object.getOwnPropertyDescriptor(globalThis, name);
      expect(own?.value).toBeUndefined();
      expect(own?.configurable).toBe(false);
      // and not reachable by normal lookup
      expect((globalThis as Record<string, unknown>)[name]).toBeUndefined();
    } finally {
      // the shadow is non-configurable by design; give the test realm a clean
      // slate by re-defining via the only remaining path: delete from the
      // prototype was already asserted, and the own shadow is inert (value
      // undefined), which is exactly the state a worker is left in.
    }
  });

  it("tolerates names that exist nowhere in the chain", () => {
    expect(() =>
      removeGlobalsEverywhere(["__pxiNeverExisted__"])
    ).not.toThrow();
    expect(
      Object.getOwnPropertyDescriptor(globalThis, "__pxiNeverExisted__")?.value
    ).toBeUndefined();
  });
});
