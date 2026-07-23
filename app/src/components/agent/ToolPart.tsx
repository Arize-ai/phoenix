import { css } from "@emotion/react";
import { getToolName } from "ai";
import { useEffect, useRef, useState } from "react";

import { getAgentToolUIBehavior } from "@phoenix/agent/extensions/toolRegistry";
import {
  CREATE_ANNOTATION_CONFIG_TOOL_NAME,
  UPDATE_ANNOTATION_CONFIG_TOOL_NAME,
} from "@phoenix/agent/tools/annotationConfig";
import { BATCH_SPAN_ANNOTATE_TOOL_NAME } from "@phoenix/agent/tools/batchSpanAnnotate";
import { EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME } from "@phoenix/agent/tools/codeEvaluatorDraft";
import { CREATE_DATASET_TOOL_NAME } from "@phoenix/agent/tools/createDataset";
import {
  DELETE_DATASET_TOOL_NAME,
  PATCH_DATASET_TOOL_NAME,
} from "@phoenix/agent/tools/datasetEdit";
import {
  ADD_DATASET_EXAMPLES_TOOL_NAME,
  DELETE_DATASET_EXAMPLES_TOOL_NAME,
  LIST_DATASET_EXAMPLES_TOOL_NAME,
  PATCH_DATASET_EXAMPLES_TOOL_NAME,
} from "@phoenix/agent/tools/datasetExamples";
import {
  CREATE_DATASET_LABEL_TOOL_NAME,
  DELETE_DATASET_LABELS_TOOL_NAME,
  LIST_DATASET_LABELS_TOOL_NAME,
  LIST_LABELS_TOOL_NAME,
  SET_DATASET_LABELS_TOOL_NAME,
} from "@phoenix/agent/tools/datasetLabels";
import {
  CREATE_DATASET_SPLIT_TOOL_NAME,
  DELETE_DATASET_SPLITS_TOOL_NAME,
  LIST_DATASET_SPLITS_TOOL_NAME,
  LIST_SPLITS_TOOL_NAME,
  PATCH_DATASET_SPLIT_TOOL_NAME,
  SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME,
} from "@phoenix/agent/tools/datasetSplits";
import { LIST_DATASETS_TOOL_NAME } from "@phoenix/agent/tools/listDatasets";
import { EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { PATCH_EXPERIMENT_TOOL_NAME } from "@phoenix/agent/tools/patchExperiment";
import { LOAD_DATASET_TOOL_NAME } from "@phoenix/agent/tools/playgroundLoadDataset";
import {
  EDIT_PROMPT_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";
import { WRITE_PROMPT_TOOLS_TOOL_NAME } from "@phoenix/agent/tools/playgroundPromptTools";
import { SAVE_PROMPT_TOOL_NAME } from "@phoenix/agent/tools/playgroundSavePrompt";
import {
  parseSetSpansFilterInput,
  SET_SPANS_FILTER_TOOL_NAME,
} from "@phoenix/agent/tools/spansFilter";
import { ADD_SPANS_TO_DATASET_TOOL_NAME } from "@phoenix/agent/tools/spansToDataset";
import { Icon, Icons } from "@phoenix/components";
import type { Variant } from "@phoenix/components/core/types";
import { MarkdownBlock } from "@phoenix/components/markdown";

import {
  AddDatasetExamplesToolDetails,
  getAddDatasetExamplesToolPreview,
} from "./AddDatasetExamplesToolDetails";
import {
  AnnotationConfigWriteToolDetails,
  getCreateAnnotationConfigToolPreview,
  getUpdateAnnotationConfigToolPreview,
} from "./AnnotationConfigWriteToolDetails";
import {
  AskUserToolDetails,
  formatAskUserState,
  getAskUserToolPreview,
} from "./AskUserToolDetails";
import { BashToolDetails, getBashToolPreview } from "./BashToolDetails";
import {
  BatchSpanAnnotateToolDetails,
  formatBatchSpanAnnotateState,
  getBatchSpanAnnotateToolPreview,
} from "./BatchSpanAnnotateToolDetails";
import {
  CreateDatasetToolDetails,
  getCreateDatasetToolPreview,
} from "./CreateDatasetToolDetails";
import { DatasetReadToolDetails } from "./DatasetReadToolDetails";
import {
  getListDatasetExamplesToolPreview,
  getListDatasetsToolPreview,
} from "./datasetReadToolPreviews";
import { DatasetSplitWriteToolDetails } from "./DatasetSplitWriteToolDetails";
import {
  DocsToolDetails,
  formatDocsToolState,
  getDocsToolPreview,
  isDocsToolName,
} from "./DocsToolDetails";
import {
  EditCodeEvaluatorDraftToolDetails,
  formatEditCodeEvaluatorDraftState,
  getEditCodeEvaluatorDraftToolPreview,
} from "./EditCodeEvaluatorDraftToolDetails";
import {
  EditLLMEvaluatorDraftToolDetails,
  formatEditLlmEvaluatorDraftState,
  getEditLlmEvaluatorDraftToolPreview,
} from "./EditLLMEvaluatorDraftToolDetails";
import {
  EditPromptToolDetails,
  formatEditPromptState,
  getEditPromptToolPreview,
} from "./EditPromptToolDetails";
import {
  formatLoadDatasetState,
  getLoadDatasetStatusVariant,
  getLoadDatasetToolPreview,
  LoadDatasetToolDetails,
} from "./LoadDatasetToolDetails";
import {
  getLoadSkillToolPreview,
  LOAD_SKILL_TOOL_NAME,
  LoadSkillToolDetails,
} from "./LoadSkillToolDetails";
import {
  formatPatchExperimentState,
  getPatchExperimentStatusVariant,
  getPatchExperimentToolPreview,
  PatchExperimentToolDetails,
} from "./PatchExperimentToolDetails";
import {
  getReadSkillResourceToolPreview,
  READ_SKILL_RESOURCE_TOOL_NAME,
  ReadSkillResourceToolDetails,
} from "./ReadSkillResourceToolDetails";
import {
  formatRemovePromptInstanceState,
  getRemovePromptInstanceStatusVariant,
  getRemovePromptInstanceToolPreview,
  RemovePromptInstanceToolDetails,
} from "./RemovePromptInstanceToolDetails";
import {
  formatSavePromptState,
  getSavePromptStatusVariant,
  getSavePromptToolPreview,
  SavePromptToolDetails,
} from "./SavePromptToolDetails";
import { getScrollableParent } from "./scrollAnchor";
import { ToolExecutionSummary } from "./ToolExecutionSummary";
import { getToolIconKey } from "./toolIconConfig";
import {
  TOOL_PART_ENTRY_KEYFRAMES,
  TOOL_CALL_SUMMARY_LANE_RULES,
  ToolPartCodeBlock,
  ToolPartExpandableSection,
  ToolPartLabel,
  ToolPartStatus,
} from "./ToolPartPrimitives";
import type { MessagePart, ToolInvocationPart } from "./toolPartTypes";
import {
  formatToolState,
  isToolUIPart,
  stringifyToolValue,
} from "./toolPartTypes";
import { useToolDisclosure } from "./useToolDisclosure";
import {
  formatWritePromptToolsState,
  getWritePromptToolsToolPreview,
  WritePromptToolsToolDetails,
} from "./WritePromptToolsToolDetails";

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
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: calc(-1 * var(--focus-ring-thickness));
    }
  }

  summary::-webkit-details-marker {
    display: none;
  }

  &[open] > summary {
    border-bottom: 1px solid var(--tool-call-body-border-color);
  }

  /* Rotate chevron when open */
  &[open] > summary .tool-part__chevron {
    transform: rotate(90deg);
  }

  .tool-part__body {
    background: var(--tool-call-body-background-color);
    font-family: var(--global-font-family-mono);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
    padding-top: var(--global-dimension-size-125);
    padding-bottom: var(--global-dimension-size-75);
  }

  .tool-part__subagent-message {
    font-family: var(--global-font-family-sans);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    padding: 0 var(--global-dimension-size-250) var(--global-dimension-size-125);
  }

  .tool-part__subagent-message > .tool-part {
    margin-top: var(--global-dimension-size-100);
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
    font-family: var(--global-font-family-mono);
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
    color: var(--global-color-warning);
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
    transition: transform 200ms ease-in-out;
    transform: rotate(0deg);
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
    color: var(--global-color-warning);
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

  /* Quiet variant: minimal chrome, responds to actual [open] state */
  &[data-variant="quiet"] {
    border-color: transparent;
    background: none;
    overflow: visible;
    transition: border-color 150ms ease;

    > summary {
      background: none;
    }

    .tool-part__title {
      flex: none;
      min-width: 0;
      max-width: none;
    }
  }

  /* Quiet expanded: lefthand line style like tool groups */
  &[data-variant="quiet"][open] {
    border-left-color: var(--tool-call-body-border-color);
    border-radius: 0;

    &[data-header-active="true"] {
      border-left-color: var(--tool-call-border-color-hover);
      transition: none;
    }

    > summary {
      border-bottom: none;
    }

    > summary .tool-part__summary {
      font-size: var(--global-font-size-s);
    }

    > summary .tool-part__title-text {
      color: var(--tool-call-quiet-color);
    }

    > div > .tool-part__body {
      background: none;
    }
  }
`;

/**
 * Collapsible detail view for a single tool invocation within an assistant
 * message. Dispatches to tool-specific sub-components for the preview text,
 * state label, and expanded body.
 */
export function ToolPart({
  part,
  defaultOpen,
}: {
  part: MessagePart;
  /**
   * Forces the initial open/closed state, overriding the per-tool auto-open
   * heuristic. The user can still toggle it afterwards.
   */
  defaultOpen?: boolean;
}) {
  if (!isToolUIPart(part)) {
    return null;
  }

  return <ToolInvocationPartDetails part={part} defaultOpen={defaultOpen} />;
}

/**
 * Smoothly scrolls `element` to the top of its nearest scrollable ancestor,
 * scrolling only that container.
 *
 * Unlike the native `Element.scrollIntoView`, which scrolls every scrollable
 * ancestor (and can move the whole page/layout), this confines the scroll to
 * the chat message list. The native behavior previously bubbled up to the
 * floating panel's `overflow: hidden` flex column, clipping the panel header
 * and leaving a gap beneath the footer when a tool part auto-opened for
 * approval. Does nothing when no scrollable ancestor is found.
 *
 * @param element - The element to bring into view within its scroll container.
 */
function scrollElementIntoViewWithinScrollParent(element: HTMLElement): void {
  const scrollParent = getScrollableParent(element);
  if (!scrollParent) {
    return;
  }
  const parentRect = scrollParent.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  // Distance to scroll so the element's top sits near the top of the viewport
  // with a small margin for context.
  const topMargin = 16;
  const delta = elementRect.top - parentRect.top - topMargin;
  scrollParent.scrollBy({ top: delta, behavior: "smooth" });
}

/**
 * Renders the right-hand status for a single tool call. Completed / failed /
 * running map to the compact {@link ToolExecutionSummary} (icon only — a single
 * call has no meaningful count). `approval-requested` ("Awaiting approval") and
 * `output-denied` ("Denied") have no clean icon in that system, so they keep
 * their text label.
 */
function renderToolPartStatus(
  state: ToolInvocationPart["state"],
  stateLabel: string,
  statusVariant: StatusVariant | undefined
) {
  switch (state) {
    case "output-available":
      return (
        <span className="tool-part__status">
          <ToolExecutionSummary completed />
        </span>
      );
    case "output-error":
      return (
        <span className="tool-part__status">
          <ToolExecutionSummary failed />
        </span>
      );
    case "input-streaming":
    case "input-available":
    case "approval-responded":
      return (
        <span className="tool-part__status">
          <ToolExecutionSummary running />
        </span>
      );
    case "approval-requested":
    case "output-denied":
      return (
        <ToolPartStatus variant={statusVariant}>{stateLabel}</ToolPartStatus>
      );
  }
}

function ToolInvocationPartDetails({
  part,
  defaultOpen,
}: {
  part: ToolInvocationPart;
  defaultOpen?: boolean;
}) {
  const toolName = getToolName(part);
  const uiBehavior = getAgentToolUIBehavior(toolName);
  const hasAutoOpenedRef = useRef(false);
  const [isHeaderActive, setIsHeaderActive] = useState(false);
  const { preview, stateLabel, statusVariant, details, variant, quietLabel } =
    getToolPresentation(toolName, part);
  const shouldAutoOpen = shouldAutoOpenToolPart(part);
  const {
    ref: detailsRef,
    isOpen: isRenderedOpen,
    toggle,
  } = useToolDisclosure<HTMLDetailsElement>({
    defaultOpen: defaultOpen ?? shouldAutoOpen,
  });

  useEffect(() => {
    if (!shouldAutoOpen || hasAutoOpenedRef.current) {
      return;
    }
    hasAutoOpenedRef.current = true;
    if (uiBehavior?.scrollIntoViewOnMount !== true) {
      return;
    }
    requestAnimationFrame(() => {
      if (detailsRef.current) {
        scrollElementIntoViewWithinScrollParent(detailsRef.current);
      }
    });
  }, [shouldAutoOpen, uiBehavior?.scrollIntoViewOnMount, detailsRef]);

  const isQuiet = variant === "quiet";
  const showQuietSummary = isQuiet && !isRenderedOpen;
  const statusState =
    part.state === "output-available" && part.preliminary === true
      ? "input-available"
      : part.state;

  return (
    <details
      ref={detailsRef}
      className="tool-part"
      css={toolPartCSS}
      open={isRenderedOpen}
      data-variant={variant}
      data-header-active={isQuiet ? isHeaderActive : undefined}
    >
      <summary
        onMouseEnter={() => setIsHeaderActive(true)}
        onMouseLeave={() => setIsHeaderActive(false)}
        onFocus={() => setIsHeaderActive(true)}
        onBlur={() => setIsHeaderActive(false)}
        onClick={(event) => {
          // Keep <details> fully React-controlled. Letting the browser toggle
          // natively can race the auto-open/manual override state during tool
          // streaming updates and make the disclosure feel stuck.
          event.preventDefault();
          toggle();
        }}
      >
        <div className="tool-part__summary">
          <span className="tool-part__title">
            <span className="tool-part__icon-slot">
              <Icon
                svg={<Icons.ChevronRightSmall />}
                className="tool-part__chevron"
              />
              <Icon
                svgKey={getToolIconKey({ toolName, input: part.input })}
                className="tool-part__tool-icon"
              />
            </span>
            {showQuietSummary ? (
              <span
                css={css`
                  color: var(--tool-call-quiet-color);
                  font-size: var(--global-font-size-s);
                `}
              >
                {quietLabel}
              </span>
            ) : (
              <span className="tool-part__title-text">{toolName}</span>
            )}
          </span>
          {showQuietSummary ? null : preview ? (
            <span className="tool-part__preview">{preview}</span>
          ) : null}
          {showQuietSummary
            ? null
            : renderToolPartStatus(statusState, stateLabel, statusVariant)}
        </div>
      </summary>
      <div>{details}</div>
    </details>
  );
}

function shouldAutoOpenToolPart(part: ToolInvocationPart): boolean {
  const toolName = getToolName(part);
  const uiBehavior = getAgentToolUIBehavior(toolName);
  if (uiBehavior?.autoOpen !== true) {
    return false;
  }
  // Stay collapsed while arguments are still streaming in. Auto-open tools
  // build their expanded body from a pending client-action that only exists
  // once the input is complete (`input-available`), so opening mid-stream
  // shows an empty shell even though the collapsed preview is already
  // derivable. The collapsed row still surfaces the preview and a running
  // spinner until the input finishes, then auto-opens with real content.
  return part.state !== "input-streaming";
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
 * The main agent's delegation tool name as it appears in AI SDK tool
 * invocation parts.
 */
const CALL_SUBAGENT_TOOL_NAME = "call_subagent";

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

/** A subset of the global {@link Variant} type used for tool part chrome. */
type ToolVariant = Extract<Variant, "default" | "quiet">;

/**
 * Generic expanded details for tools without a bespoke renderer: pretty-printed
 * JSON input, plus output or error depending on the tool state.
 */
function GenericToolDetails({ part }: { part: ToolInvocationPart }) {
  const inputStr = JSON.stringify(part.input, null, 2);
  const outputStr =
    part.state === "output-available"
      ? JSON.stringify(part.output, null, 2)
      : "";
  const errorStr = part.errorText ?? "";
  return (
    <div className="tool-part__body">
      <ToolPartLabel>Input</ToolPartLabel>
      <ToolPartExpandableSection>
        <ToolPartCodeBlock>{inputStr}</ToolPartCodeBlock>
      </ToolPartExpandableSection>
      {part.state === "output-available" ? (
        <>
          <ToolPartLabel>Output</ToolPartLabel>
          <ToolPartExpandableSection>
            <ToolPartCodeBlock>{outputStr}</ToolPartCodeBlock>
          </ToolPartExpandableSection>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartExpandableSection>
            <ToolPartCodeBlock>{errorStr}</ToolPartCodeBlock>
          </ToolPartExpandableSection>
        </>
      ) : null}
    </div>
  );
}

type CallSubagentOutput = {
  summary: string;
  messageParts: MessagePart[];
};

function CallSubagentToolDetails({ part }: { part: ToolInvocationPart }) {
  const output =
    part.state === "output-available"
      ? parseCallSubagentOutput(part.output)
      : null;
  if (!output) {
    return <GenericToolDetails part={part} />;
  }

  return (
    <div className="tool-part__body">
      {output.summary ? (
        <>
          <ToolPartLabel>Summary</ToolPartLabel>
          <ToolPartExpandableSection>
            <ToolPartCodeBlock>{output.summary}</ToolPartCodeBlock>
          </ToolPartExpandableSection>
        </>
      ) : null}
      <ToolPartLabel>Subagent</ToolPartLabel>
      <div className="tool-part__subagent-message">
        {output.messageParts.map((messagePart, index) => (
          <CallSubagentMessagePart
            key={`${messagePart.type}-${index}`}
            part={messagePart}
          />
        ))}
      </div>
    </div>
  );
}

function CallSubagentMessagePart({ part }: { part: MessagePart }) {
  if (part.type === "text") {
    if (part.text.trim().length === 0) {
      return null;
    }
    return (
      <MarkdownBlock mode="markdown" renderMode="streaming" margin="none">
        {part.text}
      </MarkdownBlock>
    );
  }
  if (part.type === "reasoning") {
    if (part.text.trim().length === 0) {
      return null;
    }
    return (
      <ToolPartExpandableSection>
        <ToolPartCodeBlock>{part.text}</ToolPartCodeBlock>
      </ToolPartExpandableSection>
    );
  }
  if (part.type === "step-start") {
    return null;
  }
  if (isToolUIPart(part)) {
    return <ToolPart part={part} />;
  }
  const value = stringifyToolValue(part);
  if (value.trim().length === 0) {
    return null;
  }
  return (
    <ToolPartExpandableSection>
      <ToolPartCodeBlock>{value}</ToolPartCodeBlock>
    </ToolPartExpandableSection>
  );
}

function parseCallSubagentOutput(output: unknown): CallSubagentOutput | null {
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    return null;
  }
  const outputRecord = output as Record<string, unknown>;
  const message = outputRecord.message;
  if (
    typeof message !== "object" ||
    message === null ||
    Array.isArray(message)
  ) {
    return null;
  }
  const messageRecord = message as Record<string, unknown>;
  const parts = messageRecord.parts;
  if (!isMessagePartArray(parts)) {
    return null;
  }
  const summary = outputRecord.summary;
  return {
    summary: typeof summary === "string" ? summary : "",
    messageParts: parts,
  };
}

function isMessagePartArray(value: unknown): value is MessagePart[] {
  return (
    Array.isArray(value) &&
    value.every(
      (part): part is MessagePart =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        typeof (part as { type?: unknown }).type === "string"
    )
  );
}

/**
 * Extracts the `name` argument the main agent passed to `call_subagent`, used
 * as the collapsed-row summary. Returns "" when the input is not yet available.
 */
function getCallSubagentName(part: ToolInvocationPart): string {
  const input = part.input;
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    const { name } = input as { name?: unknown };
    if (typeof name === "string") {
      return name;
    }
  }
  return "";
}

/**
 * Builds the collapsed-row preview for `set_spans_filter`. Shows the span
 * filter DSL condition, annotated with the root/all-spans scope. When the
 * condition is empty the call only resets scope, so we surface that instead.
 */
function getSetSpansFilterToolPreview(part: ToolInvocationPart): string {
  const parsed = parseSetSpansFilterInput(part.input);
  if (!parsed) {
    return "";
  }
  const condition = parsed.condition.trim();
  if (!condition) {
    return parsed.rootSpansOnly ? "Root spans only" : "All spans";
  }
  return parsed.rootSpansOnly ? `${condition} · root spans` : condition;
}

function getToolPresentation(
  toolName: string,
  part: ToolInvocationPart
): {
  preview: string;
  stateLabel: string;
  statusVariant?: StatusVariant;
  details: React.ReactNode;
  variant?: ToolVariant;
  quietLabel?: string;
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
    case WRITE_PROMPT_TOOLS_TOOL_NAME:
      return {
        preview: getWritePromptToolsToolPreview(part),
        stateLabel: formatWritePromptToolsState(part),
        statusVariant,
        details: <WritePromptToolsToolDetails part={part} />,
      };
    case SAVE_PROMPT_TOOL_NAME:
      return {
        preview: getSavePromptToolPreview(part),
        stateLabel: formatSavePromptState(part),
        statusVariant: getSavePromptStatusVariant(part) ?? statusVariant,
        details: <SavePromptToolDetails part={part} />,
      };
    case REMOVE_PROMPT_INSTANCE_TOOL_NAME:
      return {
        preview: getRemovePromptInstanceToolPreview(part),
        stateLabel: formatRemovePromptInstanceState(part),
        statusVariant:
          getRemovePromptInstanceStatusVariant(part) ?? statusVariant,
        details: <RemovePromptInstanceToolDetails part={part} />,
      };
    case LOAD_DATASET_TOOL_NAME:
      return {
        preview: getLoadDatasetToolPreview(part),
        stateLabel: formatLoadDatasetState(part),
        statusVariant: getLoadDatasetStatusVariant(part) ?? statusVariant,
        details: <LoadDatasetToolDetails part={part} />,
      };
    case CREATE_DATASET_TOOL_NAME:
      return {
        preview: getCreateDatasetToolPreview(part),
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <CreateDatasetToolDetails part={part} />,
      };
    case LIST_DATASET_EXAMPLES_TOOL_NAME:
      return {
        preview: getListDatasetExamplesToolPreview(part),
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <DatasetReadToolDetails part={part} label="Examples" />,
      };
    case LIST_DATASETS_TOOL_NAME:
      return {
        preview: getListDatasetsToolPreview(part),
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <DatasetReadToolDetails part={part} label="Datasets" />,
      };
    case LIST_DATASET_SPLITS_TOOL_NAME:
      return {
        preview: "",
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <DatasetReadToolDetails part={part} label="Splits" />,
      };
    case LIST_SPLITS_TOOL_NAME:
      return {
        preview: "",
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <DatasetReadToolDetails part={part} label="Splits" />,
      };
    case CREATE_DATASET_SPLIT_TOOL_NAME:
    case SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME:
    case CREATE_DATASET_LABEL_TOOL_NAME:
    case SET_DATASET_LABELS_TOOL_NAME:
    case PATCH_DATASET_TOOL_NAME:
    case DELETE_DATASET_TOOL_NAME:
    case PATCH_DATASET_EXAMPLES_TOOL_NAME:
    case DELETE_DATASET_EXAMPLES_TOOL_NAME:
    case PATCH_DATASET_SPLIT_TOOL_NAME:
    case DELETE_DATASET_SPLITS_TOOL_NAME:
    case DELETE_DATASET_LABELS_TOOL_NAME:
    case ADD_SPANS_TO_DATASET_TOOL_NAME:
      return {
        preview: "",
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <DatasetSplitWriteToolDetails part={part} />,
      };
    case LIST_DATASET_LABELS_TOOL_NAME:
      return {
        preview: "",
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <DatasetReadToolDetails part={part} label="Labels" />,
      };
    case LIST_LABELS_TOOL_NAME:
      return {
        preview: "",
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <DatasetReadToolDetails part={part} label="Labels" />,
      };
    case ADD_DATASET_EXAMPLES_TOOL_NAME:
      return {
        preview: getAddDatasetExamplesToolPreview(part),
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <AddDatasetExamplesToolDetails part={part} />,
      };
    case BATCH_SPAN_ANNOTATE_TOOL_NAME:
      return {
        preview: getBatchSpanAnnotateToolPreview(part),
        stateLabel: formatBatchSpanAnnotateState(part),
        statusVariant,
        details: <BatchSpanAnnotateToolDetails part={part} />,
      };
    case PATCH_EXPERIMENT_TOOL_NAME:
      return {
        preview: getPatchExperimentToolPreview(part),
        stateLabel: formatPatchExperimentState(part),
        statusVariant: getPatchExperimentStatusVariant(part) ?? statusVariant,
        details: <PatchExperimentToolDetails part={part} />,
      };
    case CREATE_ANNOTATION_CONFIG_TOOL_NAME:
      return {
        preview: getCreateAnnotationConfigToolPreview(part),
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <AnnotationConfigWriteToolDetails part={part} />,
      };
    case UPDATE_ANNOTATION_CONFIG_TOOL_NAME:
      return {
        preview: getUpdateAnnotationConfigToolPreview(part),
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <AnnotationConfigWriteToolDetails part={part} />,
      };
    case EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME:
      return {
        preview: getEditCodeEvaluatorDraftToolPreview(part),
        stateLabel: formatEditCodeEvaluatorDraftState(part),
        statusVariant,
        details: <EditCodeEvaluatorDraftToolDetails part={part} />,
      };
    case EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME:
      return {
        preview: getEditLlmEvaluatorDraftToolPreview(part),
        stateLabel: formatEditLlmEvaluatorDraftState(part),
        statusVariant,
        details: <EditLLMEvaluatorDraftToolDetails part={part} />,
      };
    case LOAD_SKILL_TOOL_NAME: {
      const skillName = getLoadSkillToolPreview(part);
      return {
        preview: skillName,
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <LoadSkillToolDetails part={part} />,
        variant: part.state === "output-available" ? "quiet" : "default",
        quietLabel: skillName ? `Loaded skill ${skillName}` : "Loaded skill",
      };
    }
    case READ_SKILL_RESOURCE_TOOL_NAME:
      return {
        preview: getReadSkillResourceToolPreview(part),
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <ReadSkillResourceToolDetails part={part} />,
      };
    case NATIVE_WEB_SEARCH_TOOL_NAME:
    case NATIVE_WEB_FETCH_TOOL_NAME:
      return {
        preview: getNativeWebToolPreview(toolName, part),
        stateLabel: formatToolState(part.state),
        statusVariant,
        // Native web tools have no bespoke renderer — fall back to the generic
        // input/output/error JSON view.
        details: <GenericToolDetails part={part} />,
      };
    case CALL_SUBAGENT_TOOL_NAME:
      return {
        preview: getCallSubagentName(part),
        stateLabel:
          part.state === "output-available" && part.preliminary === true
            ? "Running"
            : formatToolState(part.state),
        statusVariant,
        details: <CallSubagentToolDetails part={part} />,
      };
    case SET_SPANS_FILTER_TOOL_NAME:
      return {
        preview: getSetSpansFilterToolPreview(part),
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <GenericToolDetails part={part} />,
      };
    default: {
      if (isDocsToolName(toolName)) {
        return {
          preview: getDocsToolPreview(part),
          stateLabel: formatDocsToolState(part.state, part),
          statusVariant,
          details: <DocsToolDetails part={part} />,
        };
      }
      return {
        preview: "",
        stateLabel: formatToolState(part.state),
        statusVariant,
        details: <GenericToolDetails part={part} />,
      };
    }
  }
}
