import { describe, it, assertType, expect } from "vitest";
import { toSDK } from "../../../src/prompts/sdks/toSDK";
import { PromptVersion } from "../../../src/types/prompts";
import invariant from "tiny-invariant";
import {
  toAI,
  type PartialStreamTextParams,
} from "../../../src/prompts/sdks/toAI";
import {
  BASE_MOCK_PROMPT_VERSION,
  BASE_MOCK_PROMPT_VERSION_TOOLS,
  BASE_MOCK_PROMPT_VERSION_RESPONSE_FORMAT,
} from "./data";

describe("toAI type compatibility", () => {
  it("toAI output should be assignable to AI message params", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    } satisfies PromptVersion;

    const result = toAI({ prompt: mockPrompt });

    expect(result).not.toBeNull();
    invariant(result, "Expected non-null result");

    assertType<PartialStreamTextParams>(result);
  });

  it("toSDK with ai should be assignable to AI message params", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    } satisfies PromptVersion;

    const result = toSDK({
      sdk: "ai",
      prompt: mockPrompt,
    });

    expect(result).not.toBeNull();
    invariant(result, "Expected non-null result");

    assertType<PartialStreamTextParams>(result);
  });
});
