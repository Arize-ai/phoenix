import { beforeEach, describe, expect, it } from "vitest";

import {
  CHAT_MODEL_LOCAL_STORAGE_KEY,
  getStoredChatModel,
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

  // The pre-Browser-AI shape was the bare model — a stored preference from
  // that era must keep working rather than silently resetting the model.
  it("normalizes the legacy bare-model shape to a server selection", () => {
    localStorage.setItem(
      CHAT_MODEL_LOCAL_STORAGE_KEY,
      JSON.stringify({ provider: "OPENAI", modelName: "gpt-4.1" })
    );
    expect(getStoredChatModel()).toEqual({
      kind: "server",
      model: { provider: "OPENAI", modelName: "gpt-4.1" },
    });
  });

  it("returns null for unrecognized stored values", () => {
    localStorage.setItem(CHAT_MODEL_LOCAL_STORAGE_KEY, '{"kind":"martian"}');
    expect(getStoredChatModel()).toBeNull();
  });
});
