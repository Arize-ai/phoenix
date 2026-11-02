import { describe, expect, it } from "vitest";

import { toSDK } from "../../../src/prompts/sdks/toSDK";
import type { PromptVersion } from "../../../src/types/prompts";
import { BASE_MOCK_PROMPT_VERSION } from "./data";

function promptWithArguments(args: string): PromptVersion {
  return {
    ...BASE_MOCK_PROMPT_VERSION,
    template: {
      type: "chat",
      messages: [
        {
          role: "ai",
          content: [
            {
              type: "tool_call",
              tool_call_id: "call_1",
              tool_call: { type: "function", name: "test", arguments: args },
            },
          ],
        },
      ],
    },
  };
}

describe.each(["ai", "anthropic"] as const)("%s tool inputs", (sdk) => {
  it.each([
    {},
    { city: "東京", options: { days: [1, 2], active: false, unit: null } },
  ])("decodes JSON arguments %j", (input) => {
    const result = toSDK({
      sdk,
      prompt: promptWithArguments(JSON.stringify(input)),
    });

    expect(result?.messages[0]).toEqual({
      role: "assistant",
      content: [
        sdk === "ai"
          ? { type: "tool-call", toolCallId: "call_1", toolName: "test", input }
          : { type: "tool_use", id: "call_1", name: "test", input },
      ],
    });
  });

  it("returns null for malformed JSON arguments", () => {
    expect(toSDK({ sdk, prompt: promptWithArguments('{"city":') })).toBeNull();
  });
});

it("keeps OpenAI tool arguments serialized", () => {
  const args = '{ "city": "東京" }';
  const result = toSDK({ sdk: "openai", prompt: promptWithArguments(args) });

  expect(result?.messages[0]).toMatchObject({
    role: "assistant",
    tool_calls: [{ id: "call_1", function: { name: "test", arguments: args } }],
  });
});
