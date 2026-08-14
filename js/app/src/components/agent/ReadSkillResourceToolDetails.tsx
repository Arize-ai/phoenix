import {
  ToolPartCodeBlock,
  ToolPartExpandableSection,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

export const READ_SKILL_RESOURCE_TOOL_NAME = "read_skill_resource";

interface ReadSkillResourceInput {
  skillName: string;
  resourceName: string;
  args?: unknown;
}

function getReadSkillResourceInput(
  input: unknown
): ReadSkillResourceInput | null {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    const record = input as Record<string, unknown>;
    return {
      skillName: typeof record.skill_name === "string" ? record.skill_name : "",
      resourceName:
        typeof record.resource_name === "string" ? record.resource_name : "",
      args: record.args,
    };
  }
  return null;
}

/**
 * Returns the preview text for the collapsed read_skill_resource tool summary.
 */
export function getReadSkillResourceToolPreview(
  part: ToolInvocationPart
): string {
  const input = getReadSkillResourceInput(part.input);
  return input?.resourceName ?? "";
}

/**
 * Expanded detail view for a read_skill_resource invocation showing the skill,
 * resource, optional args, and returned resource content.
 */
export function ReadSkillResourceToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const input = getReadSkillResourceInput(part.input);
  const skillName = input?.skillName ?? "";
  const resourceName = input?.resourceName || stringifyToolValue(part.input);
  const args = input?.args == null ? "" : stringifyToolValue(input.args);
  const output =
    part.state === "output-available" ? stringifyToolValue(part.output) : "";

  return (
    <div className="tool-part__body">
      <ToolPartLabel>Skill</ToolPartLabel>
      <ToolPartCodeBlock>{skillName}</ToolPartCodeBlock>
      <ToolPartLabel>Resource</ToolPartLabel>
      <ToolPartCodeBlock>{resourceName}</ToolPartCodeBlock>
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
