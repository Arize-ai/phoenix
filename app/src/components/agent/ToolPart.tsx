import { css } from "@emotion/react";
import { getToolName } from "ai";

import { CopyToClipboardButton, Icon, Icons } from "@phoenix/components";

import {
  AskUserToolDetails,
  formatAskUserState,
  getAskUserToolPreview,
} from "./AskUserToolDetails";
import { BashToolDetails, getBashToolPreview } from "./BashToolDetails";
import {
  DocsToolDetails,
  formatDocsToolState,
  getDocsToolPreview,
  isDocsToolName,
} from "./DocsToolDetails";
import type { MessagePart, ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, isToolUIPart } from "./toolPartTypes";

/**
 * Re-export the message part type for consumers that need it for grouping.
 */
export type ToolPartType = MessagePart;

export const toolPartCSS = css`
  margin-top: var(--global-dimension-size-150);
  border: 1px solid var(--tool-call-border-color);
  border-radius: var(--global-rounding-small);
  background: var(--tool-call-background-color);
  overflow: hidden;
  transition: border-color 150ms ease;

  &:hover {
    border-color: var(--tool-call-border-color-hover);
  }

  &:has(+ :not(.tool-part)) {
    margin-bottom: var(--global-dimension-size-150);
  }

  summary {
    cursor: pointer;
    list-style: none;
    padding: var(--global-dimension-size-50);
    background: var(--tool-call-header-background-color);
    transition: background 150ms ease;

    &:hover {
      background: var(--tool-call-header-background-color-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--global-color-primary);
      outline-offset: -2px;
    }
  }

  summary::-webkit-details-marker {
    display: none;
  }

  &[open] summary {
    border-bottom: 1px solid var(--tool-call-body-border-color);
  }

  /* Rotate chevron when open */
  &[open] .tool-part__chevron {
    transform: rotate(0deg);
  }

  .tool-part__body {
    background: var(--tool-call-body-background-color);
    font-family: var(--ac-global-font-family-code);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
    padding-top: var(--global-dimension-size-125);
    padding-bottom: var(--global-dimension-size-75);
  }

  .tool-part__line {
    display: flex;
    align-items: flex-start;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-50) var(--global-dimension-size-250) 0;
  
    // Adds perimeter spacing when the last element isn't a copyable output,
    // such as the EXIT CODE summary line.
    &:last-child {
      padding-bottom: var(--global-dimension-size-125);
    }
  }

  .tool-part__line--copyable {
    .copy-to-clipboard-button {
      opacity: 0;
      transition: opacity 150ms ease;
    }

    &:hover .copy-to-clipboard-button {
      opacity: 1;
    }

    &:last-child {
      padding-bottom: 0;
    }
  }

  .tool-part__code {
    flex: 1;
    min-width: 0;
  }

  .tool-part__summary {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    color: var(--tool-call-title-color);
    font-size: var(--global-font-size-xs);
    min-width: 0;
  }

  .tool-part__title {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    font-weight: 400;
    white-space: nowrap;
    flex-shrink: 0;
    color: var(--global-text-color-800);
  }

  .tool-part__preview {
    font-weight: 400;
    font-family: var(--ac-global-font-family-code);
    color: var(--tool-call-secondary-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .tool-part__status {
    margin-left: auto;
    flex-shrink: 0;
    white-space: nowrap;
    font-size: var(--global-font-size-xs);
    color: var(--tool-call-secondary-color);
    padding-inline-end: var(--global-dimension-size-50);
  }

  .tool-part__status[data-tone="error"] {
    color: var(--tool-call-error-color);
  }

  .tool-part__chevron {
    font-size: 18px;
    color: var(--tool-call-title-color);
    transition: transform 150ms ease;
    transform: rotate(-90deg);
  }

  .tool-part__label {
    color: var(--tool-call-secondary-color);
    text-transform: uppercase;
    font-size: var(--global-font-size-xs);
    letter-spacing: 0.05em;
    user-select: none;
  }

  .tool-part__label[data-tone="error"] {
    color: var(--tool-call-error-color);
  }
`;

/**
 * Collapsible detail view for a single tool invocation within an assistant
 * message. Dispatches to tool-specific sub-components for the preview text,
 * state label, and expanded body.
 */
export function ToolPart({ part }: { part: MessagePart }) {
  if (!isToolUIPart(part)) {
    return null;
  }

  const toolName = getToolName(part);
  const { preview, stateLabel, details } = getToolPresentation(toolName, part);
  const isError = part.state === "output-error";

  return (
    <details className="tool-part" css={toolPartCSS}>
      <summary>
        <div className="tool-part__summary">
          <span className="tool-part__title">
            <Icon svg={<Icons.ChevronDown />} className="tool-part__chevron" />
            <Icon
              svg={<Icons.WrenchOutline />}
              css={css`
                font-size: 0.75rem;
              `}
            />
            {toolName}
          </span>
          {preview ? (
            <span className="tool-part__preview">{preview}</span>
          ) : null}
          <span
            className="tool-part__status"
            data-tone={isError ? "error" : undefined}
          >
            {stateLabel}
          </span>
        </div>
      </summary>
      <div>{details}</div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

/**
 * Returns the presentation elements for a given tool: the collapsed preview
 * string, the status label, and the expanded detail JSX. New tools are
 * added as additional cases here.
 */
function getToolPresentation(
  toolName: string,
  part: ToolInvocationPart
): {
  preview: string;
  stateLabel: string;
  details: React.ReactNode;
} {
  switch (toolName) {
    case "bash":
      return {
        preview: getBashToolPreview(part),
        stateLabel: formatToolState(part.state),
        details: <BashToolDetails part={part} />,
      };
    case "ask_user":
      return {
        preview: getAskUserToolPreview(part),
        stateLabel: formatAskUserState(part.state),
        details: <AskUserToolDetails part={part} />,
      };
    default: {
      if (isDocsToolName(toolName)) {
        return {
          preview: getDocsToolPreview(part),
          stateLabel: formatDocsToolState(part.state, part),
          details: <DocsToolDetails part={part} />,
        };
      }
      const inputStr = JSON.stringify(part.input, null, 2);
      const outputStr =
        part.state === "output-available"
          ? JSON.stringify(part.output, null, 2)
          : "";
      return {
        preview: "",
        stateLabel: formatToolState(part.state),
        details: (
          <div className="tool-part__body">
            <div className="tool-part__line">
              <span className="tool-part__label">Input</span>
            </div>
            <div className="tool-part__line tool-part__line--copyable">
              <code className="tool-part__code">{inputStr}</code>
              <CopyToClipboardButton
                text={inputStr}
                size="S"
                variant="quiet"
                tooltipText="Copy input"
              />
            </div>
            {part.state === "output-available" ? (
              <>
                <div className="tool-part__line">
                  <span className="tool-part__label">Output</span>
                </div>
                <div className="tool-part__line tool-part__line--copyable">
                  <code className="tool-part__code">{outputStr}</code>
                  <CopyToClipboardButton
                    text={outputStr}
                    size="S"
                    variant="quiet"
                    tooltipText="Copy output"
                  />
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
        ),
      };
    }
  }
}
