import { describe, it, expect } from "vitest";
import { INSIGHT_SYSTEM_PROMPT } from "../../src/prompts/index.js";

describe("prompts/index", () => {
  it("should re-export INSIGHT_SYSTEM_PROMPT", () => {
    expect(INSIGHT_SYSTEM_PROMPT).toBeDefined();
    expect(typeof INSIGHT_SYSTEM_PROMPT).toBe("string");
    expect(INSIGHT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });
});
