import { css } from "@emotion/react";
import { getToolName } from "ai";
import { useEffect, useRef, useState } from "react";

import { getAgentToolUIBehavior } from "@phoenix/agent/extensions/toolRegistry";
import { EDIT_PROMPT_TOOL_NAME } from "@phoenix/agent/tools/playgroundPrompt";
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
import {
  EditPromptToolDetails,
  formatEditPromptState,
  getEditPromptToolPreview,
} from "./EditPromptToolDetails";
import {
  TOOL_PART_ENTRY_KEYFRAMES,
  TOOL_CALL_SUMMARY_LANE_RULES,
  ToolPartCodeBlock,
  ToolPartLabel,
  ToolPartStatus,
} from "./ToolPartPrimitives";
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
  opacity: 0;
  transform: translateY(-2px);
  animation: ${TOOL_PART_ENTRY_KEYFRAMES} 250ms ease-out forwards;
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
    background: var(--global-code-block-header-background-color);

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
    position: relative;
    padding-bottom: var(--global-dimension-size-150);
    padding-right: calc(var(--global-dimension-size-250) + 28px);

    .copy-to-clipboard-button {
      position: absolute;
      top: 0;
      right: var(--global-dimension-size-250);
      opacity: 0;
      transition: opacity 150ms ease;

      &:focus-within {
        opacity: 1;
      }
    }

    &:hover .copy-to-clipboard-button {
      opacity: 1;
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
    flex: ${TOOL_CALL_SUMMARY_LANE_RULES.titleFlex};
    min-width: ${TOOL_CALL_SUMMARY_LANE_RULES.titleMinWidth};
    max-width: ${TOOL_CALL_SUMMARY_LANE_RULES.titleMaxWidth};
    color: var(--global-text-color-800);
  }

  .tool-part__title-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .tool-part__preview {
    flex: ${TOOL_CALL_SUMMARY_LANE_RULES.middleFlex};
    font-weight: 400;
    font-family: var(--ac-global-font-family-code);
    color: var(--tool-call-secondary-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: ${TOOL_CALL_SUMMARY_LANE_RULES.middleMinWidth};
    transition: color 150ms ease;
  }

  .tool-part__status {
    margin-left: auto;
    flex: ${TOOL_CALL_SUMMARY_LANE_RULES.statusFlex};
    min-width: ${TOOL_CALL_SUMMARY_LANE_RULES.statusMinWidth};
    max-width: ${TOOL_CALL_SUMMARY_LANE_RULES.statusMaxWidth};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
    font-size: var(--global-font-size-xs);
    color: var(--tool-call-secondary-color);
    padding-inline-end: var(--global-dimension-size-50);
    transition: color 150ms ease;
  }

  .tool-part__status[data-variant="danger"] {
    color: var(--tool-call-error-color);
  }

  .tool-part__status[data-variant="warning"] {
    color: var(--global-color-orange-600);
  }

  .tool-part__status[data-variant="success"] {
    color: var(--global-color-success);
  }

  summary:hover .tool-part__preview,
  summary:hover .tool-part__status:not([data-variant]) {
    color: var(--tool-call-title-color);
    transition: none;
  }

  .tool-part__chevron,
  .tool-part__tool-icon {
    color: var(--tool-call-title-color);
  }

  .tool-part__icon-slot {
    position: relative;
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
  }

  .tool-part__icon-slot .tool-part__chevron,
  .tool-part__icon-slot .tool-part__tool-icon {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tool-part__chevron {
    font-size: 18px;
    transition: transform 150ms ease;
    transform: rotate(-90deg);
    opacity: 0;
  }

  .tool-part__tool-icon {
    font-size: 0.75rem;
    opacity: 1;
  }

  summary:hover .tool-part__chevron {
    opacity: 1;
  }

  summary:hover .tool-part__tool-icon {
    opacity: 0;
  }

  .tool-part__label {
    color: var(--tool-call-secondary-color);
    text-transform: uppercase;
    font-size: var(--global-font-size-xs);
    letter-spacing: 0.05em;
    user-select: none;
  }

  .tool-part__label[data-variant="danger"] {
    color: var(--tool-call-error-color);
  }

  .tool-part__label[data-variant="warning"] {
    color: var(--global-color-orange-600);
  }

  .tool-part__label[data-variant="success"] {
    color: var(--global-color-success);
  }

  .tool-part__meta {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-200);
    padding: var(--global-dimension-size-50) var(--global-dimension-size-250)
      var(--global-dimension-size-150);
  }

  .tool-part__meta-group {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
  }

  .tool-part__meta-label {
    color: var(--tool-call-secondary-color);
    text-transform: uppercase;
    font-size: var(--global-font-size-xs);
    letter-spacing: 0.05em;
  }

  .tool-part__meta-value {
    color: var(--tool-call-secondary-color);
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

  return <ToolInvocationPartDetails part={part} />;
}

function ToolInvocationPartDetails({ part }: { part: ToolInvocationPart }) {
  const toolName = getToolName(part);
  const uiBehavior = getAgentToolUIBehavior(toolName);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const hasAutoOpenedRef = useRef(false);
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const { preview, stateLabel, statusVariant, details } = getToolPresentation(
    toolName,
    part
  );
  const shouldAutoOpen = shouldAutoOpenToolPart(part, preview);
  const isRenderedOpen = manualOpen ?? shouldAutoOpen;

  useEffect(() => {
    if (!shouldAutoOpen || hasAutoOpenedRef.current) {
      return;
    }
    hasAutoOpenedRef.current = true;
    if (uiBehavior?.scrollIntoViewOnMount !== true) {
      return;
    }
    requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [shouldAutoOpen, uiBehavior?.scrollIntoViewOnMount]);

  return (
    <details
      ref={detailsRef}
      className="tool-part"
      css={toolPartCSS}
      open={isRenderedOpen}
    >
      <summary
        onClick={(event) => {
          // Keep <details> fully React-controlled. Letting the browser toggle
          // natively can race the auto-open/manual override state during tool
          // streaming updates and make the disclosure feel stuck.
          event.preventDefault();
          setManualOpen(!isRenderedOpen);
        }}
      >
        <div className="tool-part__summary">
          <span className="tool-part__title">
            <span className="tool-part__icon-slot">
              <Icon
                svg={<Icons.ChevronDown />}
                className="tool-part__chevron"
              />
              <Icon
                svg={<Icons.WrenchOutline />}
                className="tool-part__tool-icon"
              />
            </span>
            <span className="tool-part__title-text">{toolName}</span>
          </span>
          {preview ? (
            <span className="tool-part__preview">{preview}</span>
          ) : null}
          <ToolPartStatus variant={statusVariant}>{stateLabel}</ToolPartStatus>
        </div>
      </summary>
      <div>{details}</div>
    </details>
  );
}

export function shouldAutoOpenToolPart(
  part: ToolInvocationPart,
  preview: string
): boolean {
  const toolName = getToolName(part);
  const uiBehavior = getAgentToolUIBehavior(toolName);
  if (uiBehavior?.autoOpen !== true) {
    return false;
  }
  // Avoid opening an empty shell while tool arguments are still absent. Once the
  // preview can be derived from arguments, the expanded details have context.
  return preview !== "" || part.state !== "input-streaming";
}

export function getToolPartPreview(part: ToolInvocationPart): string {
  return getToolPresentation(getToolName(part), part).preview;
}

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

/**
 * Returns the presentation elements for a given tool: the collapsed preview
 * string, the status label and variant, and the expanded detail JSX. New tools
 * are added as additional cases here.
 */
type StatusVariant = "danger" | "warning" | "success";

function getStatusVariant(
  state: ToolInvocationPart["state"]
): StatusVariant | undefined {
  switch (state) {
    case "output-error":
      return "danger";
    case "output-denied":
      return "warning";
    case "approval-responded":
      return "success";
    default:
      return undefined;
  }
}

/**
 * Returns a string field from arbitrary tool input records, or an empty string
 * when the field is absent or not textual.
 */
function getStringField(
  record: Record<string, unknown>,
  field: string
): string {
  const value = record[field];
  return typeof value === "string" ? value : "";
}

/**
 * Returns the first non-empty string from a list of possible field names.
 */
function getFirstStringField(
  record: Record<string, unknown>,
  fields: string[]
): string {
  for (const field of fields) {
    const value = getStringField(record, field);
    if (value) {
      return value;
    }
  }
  return "";
}

/**
 * Provider-native web tools use different input field names for target URLs.
 * Check the known URL aliases in priority order when building collapsed previews.
 */
const NATIVE_WEB_URL_FIELDS = ["url", "uri", "href"];

/**
 * Provider-native web search tools use different input field names for search
 * text. Check the known query aliases in priority order for preview text.
 */
const NATIVE_WEB_SEARCH_QUERY_FIELDS = ["query", "q", "search_query"];

/**
 * Pydantic AI's provider-native web search tool name as it appears in AI SDK
 * tool invocation parts.
 */
const NATIVE_WEB_SEARCH_TOOL_NAME = "web_search";

/**
 * Pydantic AI's provider-native web fetch tool name as it appears in AI SDK
 * tool invocation parts.
 */
const NATIVE_WEB_FETCH_TOOL_NAME = "web_fetch";

/**
 * Formats native web-search action types for display in the collapsed tool row.
 */
function formatNativeWebSearchType(type: string): string {
  return type
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Derives a compact preview for native web-search and web-fetch tool calls from
 * provider-specific input shapes.
 */
function getNativeWebToolPreview(
  toolName: string,
  part: ToolInvocationPart
): string {
  const input = part.input;
  if (typeof input === "string") {
    return input;
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return "";
  }
  const inputRecord = input as Record<string, unknown>;
  if (toolName === NATIVE_WEB_SEARCH_TOOL_NAME) {
    const type = getStringField(inputRecord, "type");
    if (type && type !== "search") {
      const value =
        getFirstStringField(inputRecord, NATIVE_WEB_URL_FIELDS) ||
        getFirstStringField(inputRecord, NATIVE_WEB_SEARCH_QUERY_FIELDS);
      const label = formatNativeWebSearchType(type);
      return value ? `${label}: ${value}` : label;
    }
    const query = getFirstStringField(
      inputRecord,
      NATIVE_WEB_SEARCH_QUERY_FIELDS
    );
    if (query) {
      return query;
    }
    const queries = inputRecord.queries;
    if (Array.isArray(queries)) {
      return (
        queries.find(
          (value): value is string =>
            typeof value === "string" && value.length > 0
        ) ?? ""
      );
    }
  }
  if (toolName === NATIVE_WEB_FETCH_TOOL_NAME) {
    return getFirstStringField(inputRecord, NATIVE_WEB_URL_FIELDS);
  }
  return "";
}

function getToolPresentation(
  toolName: string,
  part: ToolInvocationPart
): {
  preview: string;
  stateLabel: string;
  statusVariant?: StatusVariant;
  details: React.ReactNode;
} {
  const statusVariant = getStatusVariant(part.state);
  switch (toolName) {
    case "bash":
      return {
        preview: getBashToolPreview(part),
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <BashToolDetails part={part} />,
      };
    case "ask_user": {
      const stateLabel = formatAskUserState(part.state, part);
      const isError = stateLabel === "Error";
      return {
        preview: getAskUserToolPreview(part),
        stateLabel,
        statusVariant: isError ? "danger" : statusVariant,
        details: <AskUserToolDetails part={part} />,
      };
    }
    case EDIT_PROMPT_TOOL_NAME:
      return {
        preview: getEditPromptToolPreview(part),
        stateLabel: formatEditPromptState(part),
        statusVariant,
        details: <EditPromptToolDetails part={part} />,
      };
    case NATIVE_WEB_SEARCH_TOOL_NAME:
    case NATIVE_WEB_FETCH_TOOL_NAME: {
      const inputStr = JSON.stringify(part.input, null, 2);
      const outputStr =
        part.state === "output-available"
          ? JSON.stringify(part.output, null, 2)
          : "";
      return {
        preview: getNativeWebToolPreview(toolName, part),
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: (
          <div className="tool-part__body">
            <ToolPartLabel>Input</ToolPartLabel>
            <ToolPartCodeBlock>{inputStr}</ToolPartCodeBlock>
            {part.state === "output-available" ? (
              <>
                <ToolPartLabel>Output</ToolPartLabel>
                <ToolPartCodeBlock>{outputStr}</ToolPartCodeBlock>
              </>
            ) : null}
            {part.state === "output-error" ? (
              <>
                <ToolPartLabel variant="danger">Error</ToolPartLabel>
                <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
              </>
            ) : null}
          </div>
        ),
      };
    }
    default: {
      if (isDocsToolName(toolName)) {
        return {
          preview: getDocsToolPreview(part),
          stateLabel: formatDocsToolState(part.state, part),
          statusVariant,
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
        statusVariant,
        details: (
          <div className="tool-part__body">
            <ToolPartLabel>Input</ToolPartLabel>
            <ToolPartCodeBlock>{inputStr}</ToolPartCodeBlock>
            {part.state === "output-available" ? (
              <>
                <ToolPartLabel>Output</ToolPartLabel>
                <ToolPartCodeBlock>{outputStr}</ToolPartCodeBlock>
              </>
            ) : null}
            {part.state === "output-error" ? (
              <>
                <ToolPartLabel variant="danger">Error</ToolPartLabel>
                <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
              </>
            ) : null}
          </div>
        ),
      };
    }
  }
}
