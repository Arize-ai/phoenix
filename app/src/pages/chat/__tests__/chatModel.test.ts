import { describe, expect, it } from "vitest";

import { toChatModelId } from "../chatModel";

// The model id format is the wire contract with the Phoenix server's
// /v1/chat/completions endpoint — a drift here silently breaks the chat page.
describe("toChatModelId", () => {
  it("encodes built-in providers as lowercase provider:model", () => {
    expect(
      toChatModelId({ provider: "ANTHROPIC", modelName: "claude-sonnet-4-5" })
    ).toBe("anthropic:claude-sonnet-4-5");
  });

  it("keeps colons in model names intact", () => {
    expect(toChatModelId({ provider: "OLLAMA", modelName: "llama3:8b" })).toBe(
      "ollama:llama3:8b"
    );
  });

  it("encodes custom providers as custom:providerId:model", () => {
    expect(
      toChatModelId({
        provider: "OPENAI",
        modelName: "my-model",
        customProvider: {
          id: "R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6Nw==",
          name: "my-gateway",
        },
      })
    ).toBe("custom:R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6Nw==:my-model");
  });
});
