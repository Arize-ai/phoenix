import type { ChatCompletionInput } from "@phoenix/pages/playground/__generated__/PlaygroundOutputSubscription.graphql";

import { buildPromptPlaygroundChatInput } from "../usePromptPlaygroundChat";

const getBaseInput = (
  template: ChatCompletionInput["template"]
): ChatCompletionInput => ({
  promptVersion: {
    modelName: "gpt-4o",
    modelProvider: "OPENAI",
    templateFormat: "NONE",
    invocationParameters: { openai: {} },
    template: {
      messages: [
        {
          role: "SYSTEM",
          content: [{ text: { text: "Help {name} with {{name}}" } }],
        },
        {
          role: "AI",
          content: [
            {
              toolCall: {
                toolCallId: "call_1",
                toolCall: { name: "lookup", arguments: '{"name": "{name}"}' },
              },
            },
          ],
        },
      ],
    },
  },
  repetitions: 1,
  template,
});

const history = [
  { id: "1", role: "user" as const, content: 'Parse {"a": 1} for {{name}}' },
  { id: "2", role: "assistant" as const, content: '```json\n{"a": 1}\n```' },
];

describe("buildPromptPlaygroundChatInput", () => {
  it("substitutes f-string variables in the prompt and sends the conversation verbatim", () => {
    const input = buildPromptPlaygroundChatInput(
      getBaseInput({ format: "F_STRING", variables: { name: "Ada" } }),
      history
    );
    expect(input.template).toBeNull();
    expect(input.promptVersion.template.messages).toEqual([
      { role: "SYSTEM", content: [{ text: { text: "Help Ada with {name}" } }] },
      getBaseInput(null).promptVersion.template.messages[1],
      {
        role: "USER",
        content: [{ text: { text: 'Parse {"a": 1} for {{name}}' } }],
      },
      { role: "AI", content: [{ text: { text: '```json\n{"a": 1}\n```' } }] },
    ]);
  });

  it("substitutes mustache variables in the prompt only", () => {
    const input = buildPromptPlaygroundChatInput(
      getBaseInput({ format: "MUSTACHE", variables: { name: "Ada" } }),
      history
    );
    const texts = input.promptVersion.template.messages.map(
      (message) => message.content[0].text?.text
    );
    expect(texts).toEqual([
      "Help {name} with Ada",
      undefined,
      'Parse {"a": 1} for {{name}}',
      '```json\n{"a": 1}\n```',
    ]);
  });
});
