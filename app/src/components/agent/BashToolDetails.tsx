import { css } from "@emotion/react";

import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
} from "@phoenix/agent/tools/bash";
import { CopyToClipboardButton } from "@phoenix/components";

import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

const bashDetailsCSS = css`
  background: var(--tool-call-body-background-color);
  font-family: var(--ac-global-font-family-code);
  font-size: var(--global-font-size-xs);
  line-height: var(--global-line-height-xs);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  padding-top: var(--global-dimension-size-125);
  padding-bottom: var(--global-dimension-size-200);
`;

const lineCSS = css`
  display: flex;
  align-items: flex-start;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-50) var(--global-dimension-size-250) 0;

  .copy-to-clipboard-button {
    opacity: 0;
    transition: opacity 150ms ease;
  }

  &:hover .copy-to-clipboard-button {
    opacity: 1;
  }
`;

const codeCSS = css`
  flex: 1;
  min-width: 0;
`;

const labelCSS = css`
  color: var(--tool-call-secondary-color);
  text-transform: uppercase;
  font-size: var(--global-font-size-xs);
  letter-spacing: 0.05em;
  user-select: none;
`;

const metaRowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-200);
  // extra top padding makes gap consistent with outputs that contain copy buttons
  padding: var(--global-dimension-size-200) var(--global-dimension-size-250) 0;
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
    <div css={bashDetailsCSS}>
      <div css={lineCSS}>
        <span css={labelCSS}>Command</span>
      </div>
      <div css={lineCSS}>
        <code css={codeCSS}>{command || "(empty)"}</code>
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
              <div css={lineCSS}>
                <span css={labelCSS}>Output</span>
              </div>
              <div css={lineCSS}>
                <code css={codeCSS}>{stdout}</code>
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
          <div css={lineCSS}>
            <span
              css={[
                labelCSS,
                css`
                  color: var(--tool-call-error-color);
                `,
              ]}
            >
              Error
            </span>
          </div>
          <div css={lineCSS}>
            <code css={codeCSS}>{part.errorText}</code>
          </div>
        </>
      ) : null}
    </div>
  );
}
