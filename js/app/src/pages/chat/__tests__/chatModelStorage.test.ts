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

  it("returns null for unrecognized stored values", () => {
    localStorage.setItem(resolveChatModelStorageKey(), '{"kind":"martian"}');
    expect(getStoredChatModel()).toBeNull();
  });

  // Phoenix Cloud serves multiple workspaces at distinct root paths on one
  // origin — the stored model must not leak across them.
  it("scopes the storage key to the deployment root path", () => {
    const originalBasename = window.Config.basename;
    try {
      window.Config.basename = "/s/phoenix-devs";
      storeChatModel({ kind: "browser" });
      expect(
        localStorage.getItem("arize-phoenix-chat-model:/s/phoenix-devs")
      ).not.toBeNull();
      window.Config.basename = "/s/other-workspace";
      expect(getStoredChatModel()).toBeNull();
    } finally {
      window.Config.basename = originalBasename;
    }
  });
});
