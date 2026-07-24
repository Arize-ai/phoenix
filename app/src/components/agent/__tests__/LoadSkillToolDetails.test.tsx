import { describe, expect, it } from "vitest";

import {
  getLoadSkillToolPreview,
  LOAD_SKILL_TOOL_NAME,
} from "../LoadSkillToolDetails";
import type { ToolInvocationPart } from "../toolPartTypes";

/**
 * Base fixture for a load-skill tool part. Spread it into a literal annotated
 * as `ToolInvocationPart` so overrides are still checked against the
 * state-discriminated union.
 */
const LOAD_SKILL_PART = {
  type: `tool-${LOAD_SKILL_TOOL_NAME}`,
  toolCallId: "tool-call-1",
  state: "input-streaming",
  input: {},
} satisfies ToolInvocationPart;

describe("LoadSkillToolDetails", () => {
  describe("getLoadSkillToolPreview", () => {
    it("returns the skill name from input", () => {
      const part: ToolInvocationPart = {
        ...LOAD_SKILL_PART,
        state: "input-available",
        input: { skill_name: "annotate-spans" },
      };

      expect(getLoadSkillToolPreview(part)).toBe("annotate-spans");
    });

    it("returns empty string when skill_name is missing", () => {
      const part: ToolInvocationPart = {
        ...LOAD_SKILL_PART,
        state: "input-streaming",
        input: {},
      };

      expect(getLoadSkillToolPreview(part)).toBe("");
    });

    it("returns empty string for non-object input", () => {
      const part: ToolInvocationPart = {
        ...LOAD_SKILL_PART,
        state: "input-available",
        input: "some string",
      };

      expect(getLoadSkillToolPreview(part)).toBe("");
    });
  });
});
