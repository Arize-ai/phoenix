import { describe, expect, it } from "vitest";

import { resolveProjectIdentifier } from "../src/projectUtils";

describe("resolveProjectIdentifier", () => {
  it("prefers the explicit project identifier", () => {
    expect(
      resolveProjectIdentifier({
        projectIdentifier: " explicit-project ",
        defaultProjectIdentifier: "default-project",
      })
    ).toBe("explicit-project");
  });

  it("falls back to the configured default project", () => {
    expect(
      resolveProjectIdentifier({
        defaultProjectIdentifier: " default-project ",
      })
    ).toBe("default-project");
  });

  it("falls back to the legacy project name", () => {
    expect(
      resolveProjectIdentifier({
        legacyProjectIdentifier: " legacy-project ",
      })
    ).toBe("legacy-project");
  });
});
