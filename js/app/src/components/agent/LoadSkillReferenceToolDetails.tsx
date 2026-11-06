import {
  ToolPartCodeBlock,
  ToolPartExpandableSection,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

export const LOAD_SKILL_REFERENCE_TOOL_NAME = "load_skill_reference";

interface LoadSkillReferenceInput {
  skillName: string;
  referenceName: string;
  args?: unknown;
}

function getLoadSkillReferenceInput(
  input: unknown
): LoadSkillReferenceInput | null {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    const record = input as Record<string, unknown>;
    return {
      skillName: typeof record.skill_name === "string" ? record.skill_name : "",
      referenceName:
        typeof record.reference_name === "string" ? record.reference_name : "",
      args: record.args,
    };
  }
  return null;
}

/**
 * Returns the preview text for the collapsed load_skill_reference tool summary.
 */
export function getLoadSkillReferenceToolPreview(
  part: ToolInvocationPart
): string {
  const input = getLoadSkillReferenceInput(part.input);
  return input?.referenceName ?? "";
}

/**
 * Expanded detail view for a load_skill_reference invocation showing the skill,
 * reference, optional args, and returned reference content.
 */
export function LoadSkillReferenceToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const input = getLoadSkillReferenceInput(part.input);
  const skillName = input?.skillName ?? "";
  const referenceName = input?.referenceName || stringifyToolValue(part.input);
  const args = input?.args == null ? "" : stringifyToolValue(input.args);
  const output =
    part.state === "output-available" ? stringifyToolValue(part.output) : "";

  return (
    <div className="tool-part__body">
      <ToolPartLabel>Skill</ToolPartLabel>
      <ToolPartCodeBlock>{skillName}</ToolPartCodeBlock>
      <ToolPartLabel>Reference</ToolPartLabel>
      <ToolPartCodeBlock>{referenceName}</ToolPartCodeBlock>
      {args ? (
        <>
          <ToolPartLabel>Args</ToolPartLabel>
          <ToolPartCodeBlock>{args}</ToolPartCodeBlock>
        </>
      ) : null}
      {part.state === "output-available" && output ? (
        <>
          <ToolPartLabel>Content</ToolPartLabel>
          <ToolPartExpandableSection>
            <ToolPartCodeBlock>{output}</ToolPartCodeBlock>
          </ToolPartExpandableSection>
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
