import { describe, expect, it } from "vitest";

import { getInteropExports } from "../src/moduleInterop";

describe("moduleInterop", () => {
  it("returns named exports directly when no default wrapper exists", () => {
    const exports = {
      ENV_PHOENIX_API_KEY: "PHOENIX_API_KEY",
    };

    expect(getInteropExports(exports)).toBe(exports);
  });

  it("unwraps tsx-style default-wrapped module exports", () => {
    const wrappedExports = {
      default: {
        ENV_PHOENIX_API_KEY: "PHOENIX_API_KEY",
      },
    };

    expect(getInteropExports(wrappedExports)).toEqual(wrappedExports.default);
  });
});
