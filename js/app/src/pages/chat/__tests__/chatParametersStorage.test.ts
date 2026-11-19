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
  // Workspace scoping is covered by the createScopedStorageItem tests in
  // utils/__tests__/storageUtils.test.ts.
  it("falls back to the defaults for unrecognized stored values", () => {
    localStorage.setItem(
      resolveChatParametersStorageKey(),
      '{"temperature":"hot"}'
    );
    expect(getStoredChatParameters()).toEqual(DEFAULT_CHAT_PARAMETERS);
  });
});
