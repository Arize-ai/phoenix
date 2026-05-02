import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
} from "@phoenix/agent/tools/bash";

import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

/**
 * Returns the preview text for the collapsed bash tool summary.
 */
export function getBashToolPreview(part: ToolInvocationPart): string {
  const input = getBashToolInput(part.input);
  const command = input?.command ?? stringifyToolValue(part.input);
  return command ? command.split("\n")[0] : "";
}

/**
 * Expanded detail view for a bash tool invocation showing the command,
 * exit code, duration, stdout, and stderr.
 */
export function BashToolDetails({ part }: { part: ToolInvocationPart }) {
  const bashInput = getBashToolInput(part.input);
  const bashResult = getBashToolCommandDisplayResult(part.output);
  const command = bashInput?.command ?? stringifyToolValue(part.input);

  return (
    <>
      <span className="tool-part__label">Command</span>
      <pre>{command || "(empty)"}</pre>
      {part.state === "output-available" ? (
        <>
          <span className="tool-part__label">Exit code</span>
          <pre>{bashResult?.exitCode ?? "0"}</pre>
          {bashResult?.durationText ? (
            <>
              <span className="tool-part__label">Duration</span>
              <pre>{bashResult.durationText}</pre>
            </>
          ) : null}
          <span className="tool-part__label">Stdout</span>
          <pre>
            {bashResult?.stdout || "(no output)"}
            {bashResult?.stdoutBytesText
              ? `\n\n[${bashResult.stdoutBytesText}]`
              : ""}
          </pre>
          <span className="tool-part__label">Stderr</span>
          <pre>
            {bashResult?.stderr || "(no output)"}
            {bashResult?.stderrBytesText
              ? `\n\n[${bashResult.stderrBytesText}]`
              : ""}
          </pre>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <span className="tool-part__label">Error</span>
          <pre>{part.errorText}</pre>
        </>
      ) : null}
    </>
  );
}
