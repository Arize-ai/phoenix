import { describe, expect, it } from "vitest";

import {
  getLoadSkillToolPreview,
  LOAD_SKILL_TOOL_NAME,
} from "../LoadSkillToolDetails";
import type { ToolInvocationPart } from "../toolPartTypes";

function createLoadSkillPart(
  overrides: Partial<ToolInvocationPart> = {}
): ToolInvocationPart {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fixture factory coerces a loose literal into the state-discriminated tool part union
  return {
    type: `tool-${LOAD_SKILL_TOOL_NAME}`,
    toolCallId: "tool-call-1",
    state: "input-streaming",
    input: {},
    output: undefined,
    errorText: undefined,
    ...overrides,
  } as ToolInvocationPart;
}

describe("LoadSkillToolDetails", () => {
  describe("getLoadSkillToolPreview", () => {
    it("returns the skill name from input", () => {
      const part = createLoadSkillPart({
        state: "input-available",
        input: { skill_name: "annotate-spans" },
      });

      expect(getLoadSkillToolPreview(part)).toBe("annotate-spans");
    });

    it("returns empty string when skill_name is missing", () => {
      const part = createLoadSkillPart({
        state: "input-streaming",
        input: {},
      });

      expect(getLoadSkillToolPreview(part)).toBe("");
    });

    it("returns empty string for non-object input", () => {
      const part = createLoadSkillPart({
        state: "input-available",
        input: "some string",
      });

      expect(getLoadSkillToolPreview(part)).toBe("");
    });
  });
});
