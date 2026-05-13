import { DEFAULT_MODEL_NAME } from "@phoenix/constants/generativeConstants";
import type { PlaygroundInstance } from "@phoenix/store/playground";

import { instanceToPromptVersion } from "../fetchPlaygroundPrompt";
import { getDefaultInvocationConfig } from "../providerAdapters";

describe("instanceToPromptVersion", () => {
  it("preserves templateFormat and serializes OpenAI Responses max_completion_tokens", () => {
    const instance = {
      id: 1,
      template: {
        __type: "chat",
        messages: [
          {
            id: 1,
            role: "user",
            content: "Hello {{name}}",
          },
        ],
      },
      tools: [],
      toolChoice: null,
      model: {
        provider: "OPENAI",
        openaiApiType: "RESPONSES",
        modelName: "gpt-5-mini",
        customProvider: null,
        responseFormat: null,
        invocationParameters: { maxCompletionTokens: 321 },
      },
      repetitions: {
        1: {
          output: null,
          toolCalls: {},
          spanId: null,
          error: null,
          status: "notStarted",
        },
      },
      activeRunId: null,
      selectedRepetitionNumber: 1,
    } satisfies PlaygroundInstance;

    const promptVersion = instanceToPromptVersion({
      instance,
      templateFormat: "F_STRING",
    });

    expect(promptVersion).not.toBeNull();
    if (!promptVersion?.invocationParameters.openai) {
      throw new Error("Expected OpenAI invocation parameters");
    }

    expect(promptVersion.templateFormat).toBe("F_STRING");
    expect(promptVersion.template.messages).toEqual([
      {
        role: "USER",
        content: [{ text: { text: "Hello {{name}}" } }],
      },
    ]);
    expect(promptVersion.invocationParameters.openai.maxCompletionTokens).toBe(
      321
    );
    expect(promptVersion.invocationParameters.openai.maxTokens).toBeUndefined();
  });

  it("falls back to DEFAULT_MODEL_NAME when modelName is missing", () => {
    const instance = {
      id: 1,
      template: {
        __type: "chat",
        messages: [
          {
            id: 1,
            role: "system",
            content: "Be concise",
          },
        ],
      },
      tools: [],
      toolChoice: null,
      model: {
        provider: "OPENAI",
        openaiApiType: "CHAT_COMPLETIONS",
        modelName: null,
        customProvider: null,
        responseFormat: null,
        invocationParameters: getDefaultInvocationConfig("OPENAI"),
      },
      repetitions: {
        1: {
          output: null,
          toolCalls: {},
          spanId: null,
          error: null,
          status: "notStarted",
        },
      },
      activeRunId: null,
      selectedRepetitionNumber: 1,
    } satisfies PlaygroundInstance;

    const promptVersion = instanceToPromptVersion({
      instance,
      templateFormat: "MUSTACHE",
    });

    expect(promptVersion).not.toBeNull();
    expect(promptVersion?.modelName).toBe(DEFAULT_MODEL_NAME);
    expect(promptVersion?.templateFormat).toBe("MUSTACHE");
  });
});
