import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_CHAT_PARAMETERS } from "../chatParameters";
import {
  getStoredChatParameters,
  resolveChatParametersStorageKey,
  storeChatParameters,
} from "../chatParametersStorage";

describe("chat parameters storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the defaults when nothing is stored", () => {
    expect(getStoredChatParameters()).toEqual(DEFAULT_CHAT_PARAMETERS);
  });

  it("round-trips a customized setup", () => {
    const parameters = {
      systemPrompt: "You are terse.",
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 1024,
    };
    storeChatParameters(parameters);
    expect(getStoredChatParameters()).toEqual(parameters);
  });

  // A stored value from a future or corrupted shape must reset cleanly
  // rather than sending malformed sampling values with every request.
  it("falls back to the defaults for unrecognized stored values", () => {
    localStorage.setItem(
      resolveChatParametersStorageKey(),
      '{"temperature":"hot"}'
    );
    expect(getStoredChatParameters()).toEqual(DEFAULT_CHAT_PARAMETERS);
  });

  // Phoenix Cloud serves multiple workspaces at distinct root paths on one
  // origin — a system prompt must not leak across them.
  it("scopes the storage key to the deployment root path", () => {
    const originalBasename = window.Config.basename;
    try {
      window.Config.basename = "/s/phoenix-devs";
      storeChatParameters({
        ...DEFAULT_CHAT_PARAMETERS,
        systemPrompt: "You are terse.",
      });
      window.Config.basename = "/s/other-workspace";
      expect(getStoredChatParameters()).toEqual(DEFAULT_CHAT_PARAMETERS);
    } finally {
      window.Config.basename = originalBasename;
    }
  });
});
