import { beforeEach, describe, expect, it, vi } from "vitest";

import { _resetMessageId, _resetToolId } from "@phoenix/store/playground";

import { buildPlaygroundInstanceFieldsFromPromptConfig } from "../promptConfigToPlaygroundInstance";

const {
  readPromptInvocationParametersMock,
  readPromptInvocationParametersDataMock,
} = vi.hoisted(() => ({
  readPromptInvocationParametersMock: vi.fn(),
  readPromptInvocationParametersDataMock: vi.fn(),
}));

vi.mock(
  "@phoenix/pages/playground/PromptInvocationParametersReadableFragment",
  () => ({
    readPromptInvocationParameters: readPromptInvocationParametersMock,
    readPromptInvocationParametersData: readPromptInvocationParametersDataMock,
  })
);

describe("buildPlaygroundInstanceFieldsFromPromptConfig", () => {
  beforeEach(() => {
    _resetMessageId();
    _resetToolId();
    readPromptInvocationParametersMock.mockReset();
    readPromptInvocationParametersDataMock.mockReset();
  });

  it("hydrates shared prompt fields consistently for prompt and experiment paths", () => {
    readPromptInvocationParametersMock.mockReturnValue({
      family: "openai",
      parameters: { temperature: 0.3, maxCompletionTokens: 222 },
    });
    readPromptInvocationParametersDataMock.mockReturnValue({
      __typename: "PromptOpenAIInvocationParameters",
      temperature: 0.3,
      topP: null,
      maxCompletionTokens: 222,
      openaiMaxTokens: null,
      frequencyPenalty: null,
      presencePenalty: null,
      seed: null,
      stop: null,
      reasoningEffort: null,
      extraBody: null,
    });

    const result = buildPlaygroundInstanceFieldsFromPromptConfig({
      provider: "OPENAI",
      modelName: "gpt-5-mini",
      template: {
        __typename: "PromptChatTemplate",
        messages: [
          {
            role: "USER",
            content: [{ text: { text: "hello" } }],
          },
          {
            role: "AI",
            content: [
              {
                toolCall: {
                  toolCallId: "call-1",
                  toolCall: {
                    name: "lookup",
                    arguments: '{"q":"x"}',
                  },
                },
              },
            ],
          },
          {
            role: "TOOL",
            content: [
              {
                toolResult: {
                  toolCallId: "call-1",
                  result: "done",
                },
              },
            ],
          },
        ],
      },
      tools: {
        tools: [
          {
            __typename: "PromptToolFunction",
            function: {
              name: "lookup",
              description: "Find data",
              parameters: { type: "object" },
              strict: true,
            },
          },
        ],
        toolChoice: {
          type: "SPECIFIC_FUNCTION",
          functionName: "lookup",
        },
      },
      invocationParametersRef: null,
      responseFormat: {
        jsonSchema: {
          name: "response",
          schema: { type: "object" },
          strict: true,
        },
      },
      customProvider: { id: "cp-1", name: "custom" },
      connectionFields: {
        openaiApiType: "RESPONSES",
        baseUrl: "https://api.example.com/v1",
      },
    });

    expect(result.model.modelName).toBe("gpt-5-mini");
    expect(result.model.provider).toBe("OPENAI");
    expect(result.model.customProvider).toEqual({ id: "cp-1", name: "custom" });
    expect(result.model.openaiApiType).toBe("RESPONSES");
    expect(result.model.baseUrl).toBe("https://api.example.com/v1");
    expect(result.model.responseFormat).toEqual({
      type: "json_schema",
      jsonSchema: {
        name: "response",
        schema: { type: "object" },
        strict: true,
      },
    });
    expect(result.model.invocationParameters).toEqual({
      temperature: 0.3,
      maxCompletionTokens: 222,
    });

    expect(result.template.__type).toBe("chat");
    expect(result.template.messages).toHaveLength(3);
    expect(result.template.messages[0]).toMatchObject({
      role: "user",
      content: "hello",
    });
    expect(result.template.messages[1]).toMatchObject({
      role: "ai",
      toolCalls: [
        {
          id: "call-1",
          type: "function",
          function: {
            name: "lookup",
            arguments: { q: "x" },
          },
        },
      ],
    });
    expect(result.template.messages[2]).toMatchObject({
      role: "tool",
      toolCallId: "call-1",
      content: "done",
    });

    expect(result.tools).toMatchObject([
      {
        editorType: "json",
        definition: {
          name: "lookup",
          description: "Find data",
          parameters: { type: "object" },
          strict: true,
        },
      },
    ]);
    expect(result.toolChoice).toEqual({
      type: "SPECIFIC_FUNCTION",
      functionName: "lookup",
    });
  });

  it("handles Anthropic prompts with no tools, tool choice, or response format", () => {
    readPromptInvocationParametersMock.mockReturnValue({
      family: "anthropic",
      parameters: {
        maxTokens: 1024,
        temperature: 0.7,
        stopSequences: ["STOP"],
      },
    });
    readPromptInvocationParametersDataMock.mockReturnValue({
      __typename: "PromptAnthropicInvocationParameters",
      anthropicMaxTokens: 1024,
      temperature: 0.7,
      topP: null,
      stopSequences: ["STOP"],
      outputConfig: null,
      thinking: null,
      extraBody: null,
    });

    const result = buildPlaygroundInstanceFieldsFromPromptConfig({
      provider: "ANTHROPIC",
      modelName: "claude-sonnet-4-6",
      template: {
        __typename: "PromptChatTemplate",
        messages: [
          {
            role: "SYSTEM",
            content: [{ text: { text: "Be concise." } }],
          },
        ],
      },
      tools: null,
      invocationParametersRef: null,
      responseFormat: null,
    });

    expect(result.model.provider).toBe("ANTHROPIC");
    expect(result.model.customProvider).toBeNull();
    expect(result.model.responseFormat).toBeNull();
    expect(result.model.invocationParameters).toEqual({
      maxTokens: 1024,
      temperature: 0.7,
      stopSequences: ["STOP"],
    });

    expect(result.template.messages).toEqual([
      expect.objectContaining({
        role: "system",
        content: "Be concise.",
      }),
    ]);
    expect(result.tools).toEqual([]);
    expect(result.toolChoice).toBeUndefined();
  });

  it("hydrates OpenAI reasoning effort as lowercase form-store value", () => {
    readPromptInvocationParametersMock.mockReturnValue({
      family: "openai",
      parameters: { reasoningEffort: "high" },
    });
    readPromptInvocationParametersDataMock.mockReturnValue({
      __typename: "PromptOpenAIInvocationParameters",
      temperature: null,
      topP: null,
      maxCompletionTokens: null,
      openaiMaxTokens: null,
      frequencyPenalty: null,
      presencePenalty: null,
      seed: null,
      stop: null,
      reasoningEffort: "HIGH",
      extraBody: null,
    });

    const result = buildPlaygroundInstanceFieldsFromPromptConfig({
      provider: "OPENAI",
      modelName: "gpt-5",
      template: {
        __typename: "PromptChatTemplate",
        messages: [
          {
            role: "USER",
            content: [{ text: { text: "hello" } }],
          },
        ],
      },
      tools: null,
      invocationParametersRef: null,
      responseFormat: null,
    });

    expect(result.model.openaiApiType).toBe("RESPONSES");
    expect(result.model.invocationParameters).toEqual({
      reasoningEffort: "high",
    });
  });

  it("infers OpenAI Responses API type from raw prompt tools", () => {
    readPromptInvocationParametersMock.mockReturnValue({
      family: "openai",
      parameters: {
        maxOutputTokens: 333,
        reasoning: { effort: "low" },
      },
    });
    readPromptInvocationParametersDataMock.mockReturnValue({
      __typename: "PromptOpenAIInvocationParameters",
      temperature: null,
      topP: null,
      // Prompt schema only exposes maxCompletionTokens / openaiMaxTokens; the
      // Responses-only maxOutputTokens variant is folded into maxCompletionTokens
      // at the read seam. Mirror that here so the adapter sees the expected key.
      maxCompletionTokens: 333,
      openaiMaxTokens: null,
      frequencyPenalty: null,
      presencePenalty: null,
      seed: null,
      stop: null,
      reasoningEffort: "LOW",
      extraBody: null,
    });

    const result = buildPlaygroundInstanceFieldsFromPromptConfig({
      provider: "OPENAI",
      modelName: "gpt-5",
      template: {
        __typename: "PromptChatTemplate",
        messages: [
          {
            role: "USER",
            content: [{ text: { text: "hello" } }],
          },
        ],
      },
      tools: {
        tools: [
          {
            __typename: "PromptToolRaw",
            raw: {
              type: "web_search",
              search_context_size: "medium",
            },
          },
        ],
        toolChoice: {
          type: "ONE_OR_MORE",
        },
      },
      invocationParametersRef: null,
      responseFormat: null,
    });

    expect(result.model.openaiApiType).toBe("RESPONSES");
    expect(result.model.invocationParameters).toEqual({
      maxCompletionTokens: 333,
      reasoningEffort: "low",
    });
    expect(result.tools).toEqual([
      expect.objectContaining({
        kind: "raw",
        raw: {
          type: "web_search",
          search_context_size: "medium",
        },
      }),
    ]);
    expect(result.toolChoice).toEqual({
      type: "ONE_OR_MORE",
    });
  });
});
