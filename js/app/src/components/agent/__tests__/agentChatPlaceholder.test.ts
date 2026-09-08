import { describe, expect, it } from "vitest";

import {
  COMPACTION_PLACEHOLDER_TOKEN_THRESHOLD,
  getAgentChatPlaceholder,
} from "../agentChatPlaceholder";

const availableSkillNames = new Set([
  "debug-trace",
  "evaluators",
  "playground",
]);

describe("getAgentChatPlaceholder", () => {
  it("uses the default placeholder for an empty conversation", () => {
    expect(
      getAgentChatPlaceholder({
        hasMessages: false,
        promptTokenCount: COMPACTION_PLACEHOLDER_TOKEN_THRESHOLD,
        suggestionContext: "span",
        availableSkillNames,
      })
    ).toBe("Send a message");
  });

  it("suggests compaction when the prompt reaches the token threshold", () => {
    expect(
      getAgentChatPlaceholder({
        hasMessages: true,
        promptTokenCount: COMPACTION_PLACEHOLDER_TOKEN_THRESHOLD,
        suggestionContext: "span",
        availableSkillNames,
      })
    ).toBe("Try /compact to save tokens");
  });

  it("suggests debug-trace for an active span", () => {
    expect(
      getAgentChatPlaceholder({
        hasMessages: true,
        promptTokenCount: 10_000,
        suggestionContext: "span",
        availableSkillNames,
      })
    ).toBe("Try /debug-trace to understand this span");
  });

  it("suggests debug-trace for an active trace", () => {
    expect(
      getAgentChatPlaceholder({
        hasMessages: true,
        promptTokenCount: null,
        suggestionContext: "trace",
        availableSkillNames,
      })
    ).toBe("Try /debug-trace to understand this trace");
  });

  it("suggests debug-trace for an active project", () => {
    expect(
      getAgentChatPlaceholder({
        hasMessages: true,
        promptTokenCount: null,
        suggestionContext: "project",
        availableSkillNames,
      })
    ).toBe("Try /debug-trace to find failure patterns");
  });

  it("suggests playground for an active playground", () => {
    expect(
      getAgentChatPlaceholder({
        hasMessages: true,
        promptTokenCount: null,
        suggestionContext: "playground",
        availableSkillNames,
      })
    ).toBe("Try /playground to improve this prompt");
  });

  it("suggests evaluators for an active evaluator editor", () => {
    expect(
      getAgentChatPlaceholder({
        hasMessages: true,
        promptTokenCount: null,
        suggestionContext: "evaluator",
        availableSkillNames,
      })
    ).toBe("Try /evaluators to refine this evaluator");
  });

  it("does not suggest an unavailable skill", () => {
    expect(
      getAgentChatPlaceholder({
        hasMessages: true,
        promptTokenCount: null,
        suggestionContext: "span",
        availableSkillNames: new Set(),
      })
    ).toBe("Send a message");
  });
});
