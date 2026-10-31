import { describe, expect, it } from "vitest";

import { toSDK } from "../../../src/prompts/sdks/toSDK";
import type { PromptVersion } from "../../../src/types/prompts";
import { BASE_MOCK_PROMPT_VERSION } from "./data";

const basePrompt = {
  ...BASE_MOCK_PROMPT_VERSION,
  model_provider: "ANTHROPIC",
  invocation_parameters: {
    type: "anthropic",
    anthropic: { max_tokens: 128 },
  },
} satisfies PromptVersion;

const userMessage = {
  role: "user",
  content: [{ type: "text", text: "Hello" }],
} as const;

const userTurn = {
  role: "user",
  content: "Hello",
} as const;

describe("Anthropic system messages", () => {
  it.each(["system", "developer"] as const)(
    "moves a %s string into the system parameter after formatting",
    (role) => {
      const prompt: PromptVersion = {
        ...basePrompt,
        template: {
          type: "chat",
          messages: [{ role, content: "Answer in {{language}}." }, userTurn],
        },
      };
      const result = toSDK({
        sdk: "anthropic",
        prompt,
        variables: { language: "French" },
      });

      expect(result?.system).toBe("Answer in French.");
      expect(result?.messages).toStrictEqual([userMessage]);
    }
  );

  it("preserves text block order across system and developer messages", () => {
    const prompt: PromptVersion = {
      ...basePrompt,
      template: {
        type: "chat",
        messages: [
          {
            role: "system",
            content: [
              { type: "text", text: "Answer in {{language}}." },
              { type: "text", text: "Keep it short." },
            ],
          },
          { role: "developer", content: "Use plain text." },
          userTurn,
          { role: "assistant", content: "Bonjour" },
        ],
      },
    };
    const result = toSDK({
      sdk: "anthropic",
      prompt,
      variables: { language: "French" },
    });

    expect(result?.system).toStrictEqual([
      { type: "text", text: "Answer in French." },
      { type: "text", text: "Keep it short." },
      { type: "text", text: "Use plain text." },
    ]);
    expect(result?.messages).toStrictEqual([
      userMessage,
      { role: "assistant", content: [{ type: "text", text: "Bonjour" }] },
    ]);
  });

  it("preserves an empty system string", () => {
    const prompt: PromptVersion = {
      ...basePrompt,
      template: {
        type: "chat",
        messages: [{ role: "system", content: "" }, userTurn],
      },
    };
    const result = toSDK({ sdk: "anthropic", prompt });

    expect(result?.system).toBe("");
    expect(result?.messages).toStrictEqual([userMessage]);
  });

  it("omits system when the prompt has no system instructions", () => {
    const result = toSDK({ sdk: "anthropic", prompt: basePrompt });

    expect(result).not.toHaveProperty("system");
    expect(result?.messages).toStrictEqual([userMessage]);
  });
});
