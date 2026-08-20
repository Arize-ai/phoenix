import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
  getBashToolSummary,
} from "@phoenix/agent/tools/bash";

import {
  ToolPartCodeBlock,
  ToolPartExpandableSection,
  ToolPartLabel,
  ToolPartMeta,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

/**
 * Returns the preview text for the collapsed bash tool summary.
 */
export function getBashToolPreview(part: ToolInvocationPart): string {
  const summary = getBashToolSummary(part.input);
  if (summary) {
    return summary;
  }
  const command = getBashToolInput(part.input)?.command;
  return command ? command.split("\n")[0] : "";
}

/**
 * Expanded detail view for a bash tool invocation showing the command
 * and stdout output.
 */
export function BashToolDetails({ part }: { part: ToolInvocationPart }) {
  const bashInput = getBashToolInput(part.input);
  const bashResult = getBashToolCommandDisplayResult(part.output);
  const command = bashInput?.command ?? stringifyToolValue(part.input);
  const stdout = bashResult?.stdout || "";

  const metaItems = [
    { label: "Exit code", value: bashResult?.exitCode ?? 0 },
    ...(bashResult?.durationText
      ? [{ label: "Duration", value: bashResult.durationText }]
      : []),
  ];

  return (
    <div className="tool-part__body">
      <ToolPartLabel>Command</ToolPartLabel>
      <ToolPartExpandableSection>
        <ToolPartCodeBlock>{command}</ToolPartCodeBlock>
      </ToolPartExpandableSection>
      {part.state === "output-available" ? (
        <>
          {stdout ? (
            <>
              <ToolPartLabel>Output</ToolPartLabel>
              <ToolPartExpandableSection>
                <ToolPartCodeBlock>{stdout}</ToolPartCodeBlock>
              </ToolPartExpandableSection>
            </>
          ) : null}
          <ToolPartMeta items={metaItems} />
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartExpandableSection>
            <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
          </ToolPartExpandableSection>
        </>
      ) : null}
    </div>
  );
}
