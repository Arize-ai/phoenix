import { css } from "@emotion/react";
import { getToolName } from "ai";

import { Icon, Icons } from "@phoenix/components";

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
  border-radius: var(--global-rounding-medium);
  background: var(--tool-call-background-color);
  overflow: hidden;

  &:has(+ :not(.tool-part)) {
    margin-bottom: var(--global-dimension-size-150);
  }

  summary {
    cursor: pointer;
    list-style: none;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    background: var(--tool-call-header-background-color);
    border-radius: var(--global-rounding-medium);
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
    border-radius: var(--global-rounding-medium) var(--global-rounding-medium) 0 0;
  }

  /* Rotate chevron when open */
  &[open] .tool-part__chevron {
    transform: rotate(0deg);
  }

  pre {
    margin: 0;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-s);
    font-family: var(--ac-global-font-family-code);
    background: var(--tool-call-body-background-color);
    border-top: 1px solid var(--tool-call-body-border-color);
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
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
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
  }

  .tool-part__status[data-tone="error"] {
    color: var(--tool-call-error-color);
  }

  .tool-part__chevron {
    font-size: 12px;
    color: var(--tool-call-secondary-color);
    transition: transform 150ms ease;
    transform: rotate(-90deg);
  }

  .tool-part__label {
    display: block;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150) 0;
    color: var(--tool-call-secondary-color);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
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
      return {
        preview: "",
        stateLabel: formatToolState(part.state),
        details: (
          <>
            <span className="tool-part__label">Input</span>
            <pre>{JSON.stringify(part.input, null, 2)}</pre>
            {part.state === "output-available" ? (
              <>
                <span className="tool-part__label">Output</span>
                <pre>{JSON.stringify(part.output, null, 2)}</pre>
              </>
            ) : null}
            {part.state === "output-error" ? (
              <>
                <span className="tool-part__label">Error</span>
                <pre>{part.errorText}</pre>
              </>
            ) : null}
          </>
        ),
      };
    }
  }
}
