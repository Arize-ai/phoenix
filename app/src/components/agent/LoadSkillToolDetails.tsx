import {
  ToolPartCodeBlock,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

export const LOAD_SKILL_TOOL_NAME = "load_skill";

interface LoadSkillInput {
  skill_name?: string;
}

function getLoadSkillInput(input: unknown): LoadSkillInput | null {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as LoadSkillInput;
  }
  return null;
}

/**
 * Returns the preview text for the collapsed load_skill tool summary.
 */
export function getLoadSkillToolPreview(part: ToolInvocationPart): string {
  const input = getLoadSkillInput(part.input);
  return input?.skill_name ?? "";
}

/**
 * Expanded detail view for a load_skill tool invocation showing the skill name
 * input and the loaded skill content.
 */
export function LoadSkillToolDetails({ part }: { part: ToolInvocationPart }) {
  const input = getLoadSkillInput(part.input);
  const skillName = input?.skill_name ?? stringifyToolValue(part.input);
  const output =
    part.state === "output-available" ? stringifyToolValue(part.output) : "";

  return (
    <div className="tool-part__body">
      <ToolPartLabel>Skill</ToolPartLabel>
      <ToolPartCodeBlock>{skillName}</ToolPartCodeBlock>
      {part.state === "output-available" && output ? (
        <>
          <ToolPartLabel>Content</ToolPartLabel>
          <ToolPartCodeBlock>{output}</ToolPartCodeBlock>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}
