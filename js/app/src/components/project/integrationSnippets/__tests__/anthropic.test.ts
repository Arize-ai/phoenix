import { describe, expect, it } from "vitest";

import { isAgentCuratedBuiltInModel } from "@phoenix/components/agent/agentCuratedModels";

import {
  getAnthropicCodePython,
  getAnthropicCodeTypescript,
} from "../anthropic";

const SNIPPETS = [
  ["Python", getAnthropicCodePython],
  ["TypeScript", getAnthropicCodeTypescript],
] as const;

describe("Anthropic integration snippets", () => {
  it.each(SNIPPETS)(
    "%s snippet sends a model Phoenix curates",
    (_, getCode) => {
      const code = getCode({ projectName: "my-project" });
      const modelName = /model[=:] ?"([^"]+)"/.exec(code)?.[1];

      expect(modelName).toBeDefined();
      expect(
        isAgentCuratedBuiltInModel({
          provider: "ANTHROPIC",
          modelName: modelName as string,
        })
      ).toBe(true);
    }
  );
});
