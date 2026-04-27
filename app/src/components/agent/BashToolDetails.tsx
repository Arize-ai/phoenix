import { css } from "@emotion/react";

import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
} from "@phoenix/agent/tools/bash";
import { CopyToClipboardButton } from "@phoenix/components";

import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

const metaRowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-200);
  // extra top padding makes gap consistent with outputs that contain copy buttons
  padding: var(--global-dimension-size-200) var(--global-dimension-size-250)
    var(--global-dimension-size-150);
`;

const metaGroupCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
`;

const metaLabelCSS = css`
  color: var(--tool-call-secondary-color);
  text-transform: uppercase;
  font-size: var(--global-font-size-xs);
  letter-spacing: 0.05em;
`;

const metaValueCSS = css`
  color: var(--tool-call-secondary-color);
`;

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

  return (
    <div className="tool-part__body">
      <div className="tool-part__line">
        <span className="tool-part__label">Command</span>
      </div>
      <div className="tool-part__line tool-part__line--copyable">
        <code className="tool-part__code">{command || "(empty)"}</code>
        <CopyToClipboardButton
          text={command || ""}
          size="S"
          variant="quiet"
          tooltipText="Copy command"
        />
      </div>
      {part.state === "output-available" ? (
        <>
          {stdout ? (
            <>
              <div className="tool-part__line">
                <span className="tool-part__label">Output</span>
              </div>
              <div className="tool-part__line tool-part__line--copyable">
                <code className="tool-part__code">{stdout}</code>
                <CopyToClipboardButton
                  text={stdout}
                  size="S"
                  variant="quiet"
                  tooltipText="Copy output"
                />
              </div>
            </>
          ) : null}
          <div css={metaRowCSS}>
            <span css={metaGroupCSS}>
              <span css={metaLabelCSS}>Exit code</span>
              <code css={metaValueCSS}>{bashResult?.exitCode ?? 0}</code>
            </span>
            {bashResult?.durationText ? (
              <span css={metaGroupCSS}>
                <span css={metaLabelCSS}>Duration</span>
                <code css={metaValueCSS}>{bashResult.durationText}</code>
              </span>
            ) : null}
          </div>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <div className="tool-part__line">
            <span className="tool-part__label" data-tone="error">
              Error
            </span>
          </div>
          <div className="tool-part__line tool-part__line--copyable">
            <code className="tool-part__code">{part.errorText}</code>
            <CopyToClipboardButton
              text={part.errorText ?? ""}
              size="S"
              variant="quiet"
              tooltipText="Copy error"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
