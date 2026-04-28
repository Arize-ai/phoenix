import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
} from "@phoenix/agent/tools/bash";

import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";
import {
  ToolPartCodeBlock,
  ToolPartLabel,
  ToolPartMeta,
} from "./ToolPartPrimitives";

/**
 * Returns the preview text for the collapsed bash tool summary.
 */
export function getBashToolPreview(part: ToolInvocationPart): string {
  const input = getBashToolInput(part.input);
  const command = input?.command ?? stringifyToolValue(part.input);
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
      <ToolPartCodeBlock>{command}</ToolPartCodeBlock>
      {part.state === "output-available" ? (
        <>
          {stdout ? (
            <>
              <ToolPartLabel>Output</ToolPartLabel>
              <ToolPartCodeBlock>{stdout}</ToolPartCodeBlock>
            </>
          ) : null}
          <ToolPartMeta items={metaItems} />
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
