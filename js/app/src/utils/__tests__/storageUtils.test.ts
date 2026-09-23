import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createScopedStorageItem,
  scopeStorageKeyToBasename,
} from "../storageUtils";

describe("scopeStorageKeyToBasename", () => {
  const originalBasename = window.Config.basename;
  beforeEach(() => {
    window.Config.basename = originalBasename;
  });

  it("uses the base unscoped key when there is no root path", () => {
    window.Config.basename = "/";
    expect(scopeStorageKeyToBasename("some-key")).toBe("some-key");
    window.Config.basename = "";
    expect(scopeStorageKeyToBasename("some-key")).toBe("some-key");
  });

  it("scopes the key to the deployment root path", () => {
    window.Config.basename = "/s/phoenix-devs";
    expect(scopeStorageKeyToBasename("some-key")).toBe(
      "some-key:/s/phoenix-devs"
    );
    // Trailing slashes are normalized so the key is stable.
    window.Config.basename = "/s/phoenix-devs/";
    expect(scopeStorageKeyToBasename("some-key")).toBe(
      "some-key:/s/phoenix-devs"
    );
  });
});

describe("createScopedStorageItem", () => {
  const item = createScopedStorageItem({
    baseKey: "test-item",
    schema: z.object({ value: z.number() }),
    fallback: null,
  });
  const originalBasename = window.Config.basename;

  beforeEach(() => {
    localStorage.clear();
    window.Config.basename = originalBasename;
  });

  it("round-trips a value", () => {
    item.set({ value: 42 });
    expect(item.get()).toEqual({ value: 42 });
  });

  it("falls back for missing or malformed stored values", () => {
    expect(item.get()).toBeNull();
    localStorage.setItem(item.resolveKey(), '{"value":"not-a-number"}');
    expect(item.get()).toBeNull();
    localStorage.setItem(item.resolveKey(), "not json");
    expect(item.get()).toBeNull();
  });

  // Phoenix Cloud serves multiple workspaces at distinct root paths on one
  // origin — persisted state must not leak across them.
  it("isolates values between deployment root paths", () => {
    window.Config.basename = "/s/phoenix-devs";
    item.set({ value: 1 });
    expect(item.get()).toEqual({ value: 1 });
    window.Config.basename = "/s/other-workspace";
    expect(item.get()).toBeNull();
  });
});
