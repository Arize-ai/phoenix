import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { getDefaultInvocationConfig } from "@phoenix/pages/playground/providerAdapters";
import {
  ANTHROPIC_ASSISTANT_PREFILL_UNSUPPORTED_MODELS,
  validateChatCompletionInput,
} from "@phoenix/pages/playground/playgroundUtils";
import type { ChatMessage, PlaygroundInstance } from "@phoenix/store";
import { createPlaygroundStore } from "@phoenix/store";

installTestStorage();

function makeMessage(
  id: number,
  role: ChatMessageRole,
  content = "message"
): ChatMessage {
  return { id, role, content };
}

function makeInstance({
  id,
  modelName,
  provider,
  messages,
}: {
  id: number;
  modelName: string | null;
  provider: ModelProvider;
  messages: ChatMessage[];
}): PlaygroundInstance {
  return {
    id,
    template: { __type: "chat", messages },
    tools: [],
    model: {
      provider,
      modelName,
      invocationParameters: getDefaultInvocationConfig(provider),
    },
    repetitions: {},
    activeRunId: null,
    selectedRepetitionNumber: 1,
  };
}

function makeStore(instances: PlaygroundInstance[]) {
  return createPlaygroundStore({
    datasetId: null,
    instances,
    modelConfigByProvider: {},
  });
}

function makeAnthropicInstance(modelName: string, messages: ChatMessage[]) {
  return makeInstance({ id: 0, modelName, provider: "ANTHROPIC", messages });
}

describe("validateChatCompletionInput", () => {
  it("returns an error for claude-opus-4-6 when the last message is an assistant message", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-4-6", [
        makeMessage(1, "user"),
        makeMessage(2, "ai"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).not.toBeNull();
    expect(error).toContain("claude-opus-4-6");
    expect(error).toContain("conversation A");
  });

  it("returns an error for claude-sonnet-4-6 when the last message is an assistant message", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-sonnet-4-6", [
        makeMessage(1, "user"),
        makeMessage(2, "ai"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).not.toBeNull();
    expect(error).toContain("claude-sonnet-4-6");
  });

  it("returns an error for claude-opus-5 (adaptive family) when the last message is an assistant message", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-5", [
        makeMessage(1, "user"),
        makeMessage(2, "ai"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).not.toBeNull();
    expect(error).toContain("claude-opus-5");
  });

  it("allows assistant prefill for pre-4.6 models like claude-3-5-sonnet-latest", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-3-5-sonnet-latest", [
        makeMessage(1, "user"),
        makeMessage(2, "ai"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("allows assistant prefill for claude-haiku-4-5", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-haiku-4-5", [
        makeMessage(1, "user"),
        makeMessage(2, "ai"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("allows claude-opus-4-6 when the last message is a user message", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-4-6", [
        makeMessage(1, "user"),
        makeMessage(2, "ai"),
        makeMessage(3, "user"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("allows claude-opus-4-6 when the last message is a tool message", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-4-6", [
        makeMessage(1, "user"),
        makeMessage(2, "ai"),
        makeMessage(3, "tool"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("returns an error when the last non-system message is an assistant message", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-4-6", [
        makeMessage(1, "user"),
        makeMessage(2, "ai"),
        makeMessage(3, "system"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).not.toBeNull();
  });

  it("allows claude-opus-4-6 for a [system, user] conversation", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-4-6", [
        makeMessage(1, "system"),
        makeMessage(2, "user"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("allows claude-opus-4-6 for a [user, ai, user] conversation", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-4-6", [
        makeMessage(1, "user"),
        makeMessage(2, "ai"),
        makeMessage(3, "user"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("ignores non-Anthropic providers regardless of the last message role", () => {
    const store = makeStore([
      makeInstance({
        id: 0,
        modelName: "gpt-4o",
        provider: "OPENAI",
        messages: [makeMessage(1, "user"), makeMessage(2, "ai")],
      }),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("returns null when the conversation has no messages", () => {
    const store = makeStore([makeAnthropicInstance("claude-opus-4-6", [])]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("names the offending conversation with an alphabetic label in a multi-instance playground", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-4-6", [
        makeMessage(100, "system"),
        makeMessage(101, "user"),
      ]),
      makeInstance({
        id: 1,
        modelName: "claude-opus-4-6",
        provider: "ANTHROPIC",
        messages: [makeMessage(200, "user"), makeMessage(201, "ai")],
      }),
      makeAnthropicInstance("claude-sonnet-4-6", [
        makeMessage(300, "system"),
        makeMessage(301, "user"),
      ]),
      makeAnthropicInstance("claude-opus-4-6", [
        makeMessage(400, "system"),
        makeMessage(401, "user"),
      ]),
    ]);
    const instanceId = store.getState().instances[1].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).not.toBeNull();
    expect(error).toContain("conversation B");
  });

  it("enumerates exactly the Anthropic models that reject assistant prefill", () => {
    expect(ANTHROPIC_ASSISTANT_PREFILL_UNSUPPORTED_MODELS).toEqual([
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-opus-4-7",
      "claude-opus-4-8",
      "claude-opus-5",
      "claude-sonnet-5",
      "claude-fable-5",
    ]);
    expect(ANTHROPIC_ASSISTANT_PREFILL_UNSUPPORTED_MODELS).not.toContain(
      "claude-haiku-4-5"
    );
    expect(ANTHROPIC_ASSISTANT_PREFILL_UNSUPPORTED_MODELS).not.toContain(
      "claude-3-5-sonnet-latest"
    );
  });

  it("ignores a disallowed model name when the provider is not ANTHROPIC", () => {
    const store = makeStore([
      makeInstance({
        id: 0,
        modelName: "claude-opus-4-6",
        provider: "OPENAI",
        messages: [makeMessage(1, "user"), makeMessage(2, "ai")],
      }),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("returns an error for claude-opus-4-6 on [ai, system] (last non-system is ai)", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-4-6", [
        makeMessage(1, "ai"),
        makeMessage(2, "system"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).not.toBeNull();
  });

  it("allows claude-opus-4-6 on [user, system] (last non-system is user)", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-4-6", [
        makeMessage(1, "user"),
        makeMessage(2, "system"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("returns null for a [system]-only conversation (no user/ai message to judge)", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-4-6", [makeMessage(1, "system")]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("returns null when the instance has no model name", () => {
    const store = makeStore([
      makeInstance({
        id: 0,
        modelName: null,
        provider: "ANTHROPIC",
        messages: [makeMessage(1, "user"), makeMessage(2, "ai")],
      }),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });

  it("returns null for an unknown instance id", () => {
    const store = makeStore([
      makeAnthropicInstance("claude-opus-4-6", [
        makeMessage(1, "user"),
        makeMessage(2, "ai"),
      ]),
    ]);
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId: 9999 });
    expect(error).toBeNull();
  });

  it("matches model names exactly (case-sensitive), so a case variant is not flagged", () => {
    // The blocklist is matched exactly; the Anthropic registry uses lowercase ids,
    // so a differently-cased name is treated as a different (unsupported-by-gate) model.
    const store = makeStore([
      makeAnthropicInstance("Claude-Opus-4-6", [
        makeMessage(1, "user"),
        makeMessage(2, "ai"),
      ]),
    ]);
    const instanceId = store.getState().instances[0].id;
    const error = validateChatCompletionInput({ playgroundStore: store, instanceId });
    expect(error).toBeNull();
  });
});
