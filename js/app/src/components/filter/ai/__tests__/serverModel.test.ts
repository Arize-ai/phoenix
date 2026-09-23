import { describe, expect, it } from "vitest";

import { toServerModelId } from "../serverModel";

// The model id format is the wire contract with the Phoenix server's
// /v1/chat/completions endpoint — a drift here silently breaks AI query.
describe("toServerModelId", () => {
  it("encodes built-in providers as lowercase provider:model", () => {
    expect(
      toServerModelId({
        kind: "server",
        source: "builtin",
        provider: "ANTHROPIC",
        modelName: "claude-sonnet-4-5",
      })
    ).toBe("anthropic:claude-sonnet-4-5");
  });

  it("keeps colons in model names intact", () => {
    expect(
      toServerModelId({
        kind: "server",
        source: "builtin",
        provider: "OLLAMA",
        modelName: "llama3:8b",
      })
    ).toBe("ollama:llama3:8b");
  });

  it("encodes custom providers as custom:providerId:model", () => {
    expect(
      toServerModelId({
        kind: "server",
        source: "custom",
        providerId: "R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6Nw==",
        providerName: "my-gateway",
        modelName: "my-model",
      })
    ).toBe("custom:R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6Nw==:my-model");
  });
});
