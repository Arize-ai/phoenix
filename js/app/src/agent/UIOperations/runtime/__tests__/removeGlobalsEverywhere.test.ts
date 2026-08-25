import { describe, expect, it } from "vitest";

import {
  BLOCKED_GLOBAL_NAMES,
  removeGlobalsEverywhere,
} from "@phoenix/agent/UIOperations/runtime/UIScriptWorker";

// oxlint-disable-next-line import/default -- Vite `?raw` import; the resolver can't see the synthesized default export
import workerSource from "../UIScriptWorker.ts?raw";

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

describe("BLOCKED_GLOBAL_NAMES messaging surface", () => {
  it("shadows postMessage and EventTarget so guest scripts cannot forge protocol frames", () => {
    expect(BLOCKED_GLOBAL_NAMES).toEqual(
      expect.arrayContaining([
        "postMessage",
        "onmessage",
        "onmessageerror",
        "addEventListener",
        "removeEventListener",
        "dispatchEvent",
        "close",
      ])
    );
  });

  it("binds a private postMessage before the guest-visible binding is removed", () => {
    const bindIndex = workerSource.indexOf("postMessage.bind");
    const removeIndex = workerSource.indexOf("removeBlockedGlobals()");
    expect(bindIndex).toBeGreaterThan(-1);
    expect(removeIndex).toBeGreaterThan(bindIndex);
    expect(workerSource).not.toMatch(/workerScope\.postMessage\(/);
  });
});
