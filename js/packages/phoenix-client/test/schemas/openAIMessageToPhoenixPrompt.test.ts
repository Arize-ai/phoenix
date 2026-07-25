import { describe, expect, it } from "vitest";

import { openAIMessageToPhoenixPrompt } from "../../src/schemas/llm/openai/converters";
import { phoenixMessageRoleSchema } from "../../src/schemas/llm/phoenixPrompt/messageSchemas";

/**
 * Phoenix prompt roles are lowercase — see `PromptMessage.role` in the generated
 * API types and `phoenixMessageRoleSchema`. This converter previously emitted
 * uppercase values ("SYSTEM", "USER", "AI", "TOOL"), which the server would
 * reject; the mismatch was hidden behind a type assertion.
 */
describe("openAIMessageToPhoenixPrompt", () => {
  const cases = [
    { openai: "system", phoenix: "system" },
    { openai: "user", phoenix: "user" },
    { openai: "assistant", phoenix: "ai" },
    { openai: "developer", phoenix: "system" },
  ] as const;

  it.each(cases)("maps the $openai role to $phoenix", ({ openai, phoenix }) => {
    const result = openAIMessageToPhoenixPrompt.parse({
      role: openai,
      content: "hello",
    });

    expect(result.role).toBe(phoenix);
  });

  it.each(cases)(
    "emits a role $phoenix that the Phoenix role schema accepts",
    ({ openai }) => {
      const result = openAIMessageToPhoenixPrompt.parse({
        role: openai,
        content: "hello",
      });

      expect(phoenixMessageRoleSchema.safeParse(result.role).success).toBe(
        true
      );
    }
  );
});
