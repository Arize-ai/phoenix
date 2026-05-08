import type { PlaygroundInstance } from "@phoenix/store/playground";

import type { ChatPromptVersionInput } from "../__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import type { InvocationParameterInput } from "../invocationParameterUtils";
import { buildPromptVersionInput } from "../playgroundUtils";

describe("buildPromptVersionInput", () => {
  it("builds an OpenAI prompt version payload from canonical instance state", () => {
    const instance = {
      model: {
        provider: "OPENAI",
        openaiApiType: "CHAT_COMPLETIONS",
        modelName: "gpt-4o-mini",
        customProvider: {
          id: "custom-provider-id",
          name: "custom-provider-name",
        },
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "response",
            schema: {
              type: "object",
              properties: {
                answer: { type: "string" },
              },
            },
            strict: true,
          },
        },
        invocationParameters: [],
      },
      tools: [
        {
          kind: "function",
          id: 1,
          editorType: "json",
          definition: {
            name: "lookup",
            description: "Lookup an answer",
            parameters: { type: "object" },
            strict: true,
          },
        },
      ],
      toolChoice: {
        type: "SPECIFIC_FUNCTION",
        functionName: "lookup",
      },
    } satisfies Pick<PlaygroundInstance, "model" | "tools" | "toolChoice">;
    const promptMessages = [
      {
        role: "USER",
        content: [{ text: { text: "hello" } }],
      },
    ] as ChatPromptVersionInput["template"]["messages"];
    const invocationParameters: InvocationParameterInput[] = [
      { invocationName: "temperature", valueFloat: 0.25 },
      { invocationName: "maxCompletionTokens", valueInt: 128 },
      { invocationName: "topP", valueFloat: 0.9 },
    ];

    const result = buildPromptVersionInput({
      instance,
      modelName: "gpt-4o-mini",
      templateFormat: "MUSTACHE",
      promptMessages,
      invocationParameters,
    });

    expect(result).toEqual({
      templateFormat: "MUSTACHE",
      template: {
        messages: promptMessages,
      },
      modelProvider: "OPENAI",
      modelName: "gpt-4o-mini",
      customProviderId: "custom-provider-id",
      invocationParameters: {
        openai: {
          temperature: 0.25,
          maxCompletionTokens: 128,
          frequencyPenalty: undefined,
          presencePenalty: undefined,
          topP: 0.9,
          seed: undefined,
          stop: undefined,
          reasoningEffort: undefined,
          extraBody: undefined,
        },
      },
      tools: {
        tools: [
          {
            function: {
              name: "lookup",
              description: "Lookup an answer",
              parameters: { type: "object" },
              strict: true,
            },
          },
        ],
        toolChoice: {
          functionName: "lookup",
        },
      },
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "response",
          schema: {
            type: "object",
            properties: {
              answer: { type: "string" },
            },
          },
          strict: true,
        },
      },
    });
  });

  it("uses max_completion_tokens for OpenAI Responses API models", () => {
    const instance = {
      model: {
        provider: "OPENAI",
        openaiApiType: "RESPONSES",
        modelName: "gpt-5",
        customProvider: null,
        responseFormat: null,
        invocationParameters: [],
      },
      tools: [],
      toolChoice: null,
    } satisfies Pick<PlaygroundInstance, "model" | "tools" | "toolChoice">;
    const promptMessages = [
      {
        role: "SYSTEM",
        content: [{ text: { text: "You are helpful." } }],
      },
    ] as ChatPromptVersionInput["template"]["messages"];
    const invocationParameters: InvocationParameterInput[] = [
      { invocationName: "maxCompletionTokens", valueInt: 777 },
    ];

    const result = buildPromptVersionInput({
      instance,
      modelName: "gpt-5",
      templateFormat: "NONE",
      promptMessages,
      invocationParameters,
    });

    expect(result.invocationParameters).toEqual({
      openai: {
        temperature: undefined,
        maxTokens: undefined,
        maxCompletionTokens: 777,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        topP: undefined,
        seed: undefined,
        reasoningEffort: undefined,
      },
    });
    expect(result.tools).toBeNull();
    expect(result.responseFormat).toBeNull();
    expect(result.customProviderId).toBeNull();
  });

  it("preserves raw tools in the prompt version payload", () => {
    const instance = {
      model: {
        provider: "OPENAI",
        openaiApiType: "RESPONSES",
        modelName: "gpt-5",
        customProvider: null,
        responseFormat: null,
        invocationParameters: [],
      },
      tools: [
        {
          kind: "function",
          id: 1,
          editorType: "json",
          definition: {
            name: "lookup",
            description: "Lookup an answer",
            parameters: { type: "object" },
            strict: null,
          },
        },
        {
          kind: "raw",
          id: 2,
          editorType: "json",
          raw: {
            type: "web_search",
            search_context_size: "medium",
          },
        },
      ],
      toolChoice: {
        type: "ZERO_OR_MORE",
      },
    } satisfies Pick<PlaygroundInstance, "model" | "tools" | "toolChoice">;
    const promptMessages = [
      {
        role: "USER",
        content: [{ text: { text: "hello" } }],
      },
    ] as ChatPromptVersionInput["template"]["messages"];

    const result = buildPromptVersionInput({
      instance,
      modelName: "gpt-5",
      templateFormat: "NONE",
      promptMessages,
      invocationParameters: [],
    });

    expect(result.tools).toEqual({
      tools: [
        {
          function: {
            name: "lookup",
            description: "Lookup an answer",
            parameters: { type: "object" },
            strict: null,
          },
        },
        {
          raw: {
            type: "web_search",
            search_context_size: "medium",
          },
        },
      ],
      toolChoice: {
        zeroOrMore: true,
      },
    });
  });
});
