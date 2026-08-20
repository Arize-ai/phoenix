import { beforeEach, describe, expect, it } from "vitest";

import {
  getStoredChatModel,
  resolveChatModelStorageKey,
  storeChatModel,
} from "../chatModelStorage";

describe("chat model storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a browser selection", () => {
    storeChatModel({ kind: "browser" });
    expect(getStoredChatModel()).toEqual({ kind: "browser" });
  });

  it("round-trips a server selection", () => {
    storeChatModel({
      kind: "server",
      model: { provider: "ANTHROPIC", modelName: "claude-sonnet-4-5" },
    });
    expect(getStoredChatModel()).toEqual({
      kind: "server",
      model: { provider: "ANTHROPIC", modelName: "claude-sonnet-4-5" },
    });
  });

  // Workspace scoping and malformed-value fallback are covered by the
  // createScopedStorageItem tests in utils/__tests__/storageUtils.test.ts.
  it("returns null for unrecognized stored values", () => {
    localStorage.setItem(resolveChatModelStorageKey(), '{"kind":"martian"}');
    expect(getStoredChatModel()).toBeNull();
  });
});
