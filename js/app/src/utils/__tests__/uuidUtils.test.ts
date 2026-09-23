import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { generateUUID } from "../uuidUtils";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateUUID", () => {
  it("returns a valid UUID v4 format", () => {
    const id = generateUUID();
    expect(id).toMatch(UUID_PATTERN);
  });

  it("returns unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateUUID()));
    expect(ids.size).toBe(20);
  });

  describe("when crypto.randomUUID is unavailable (non-secure context)", () => {
    const originalRandomUUID = crypto.randomUUID;

    beforeEach(() => {
      // Simulate a non-secure context where randomUUID is not exposed
      // @ts-expect-error — intentionally removing for test
      crypto.randomUUID = undefined;
    });

    afterEach(() => {
      crypto.randomUUID = originalRandomUUID;
    });

    it("falls back to crypto.getRandomValues and returns a valid UUID v4", () => {
      const id = generateUUID();
      expect(id).toMatch(UUID_PATTERN);
    });

    it("returns unique values via the fallback path", () => {
      const ids = new Set(Array.from({ length: 20 }, () => generateUUID()));
      expect(ids.size).toBe(20);
    });
  });
});
