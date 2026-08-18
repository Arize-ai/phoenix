import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { requireToolSession } from "@phoenix/agent/extensions/registry/requireToolSession";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

import { applyAnnotation } from "./applyAnnotation";
import { ANNOTATE_TOOL_NAME } from "./constants";
import { parseAnnotateInput } from "./parsers";
import { stageAnnotate } from "./pendingAnnotate";
import type { AnnotateInput } from "./types";

function isEmptyAnnotateInput(input: unknown): boolean {
  if (input == null) return true;
  if (!isPlainObject(input)) return false;
  if (Object.keys(input).length === 0) return true;
  const {
    spanId,
    spanNodeId,
    traceId,
    traceNodeId,
    sessionId,
    sessionNodeId,
    label,
    score,
    explanation,
  } = input;
  const hasTarget = Boolean(
    spanId || spanNodeId || traceId || traceNodeId || sessionId || sessionNodeId
  );
  const hasValue = label != null || score != null || explanation != null;
  return !hasTarget && !hasValue;
}

/**
 * Proposes one span, trace, or session annotation as a pending change.
 * Auto-applies when edit approvals are bypassed; otherwise stores the proposal
 * for the UI to accept or reject. Requires an active session to attribute the
 * change.
 */
export const annotateAgentTool = defineTool<AnnotateInput>({
  name: ANNOTATE_TOOL_NAME,
  parseInput: parseAnnotateInput,
  invalidInputErrorText: (input) =>
    isEmptyAnnotateInput(input)
      ? `${ANNOTATE_TOOL_NAME} needs a target and a value. Call it with exactly one of spanId, spanNodeId, traceId, traceNodeId, sessionId, or sessionNodeId, plus name and at least one of label, score, or explanation. Do not call this tool until you have a real id and annotation value.`
      : `Invalid ${ANNOTATE_TOOL_NAME} input. Expected { spanId?: string, spanNodeId?: string, traceId?: string, traceNodeId?: string, sessionId?: string, sessionNodeId?: string, name: string, annotatorKind?: "LLM" | "HUMAN" | "CODE", label?: string | null, score?: number | null, explanation?: string | null, identifier?: string | null, metadata?: object | null }. Provide exactly one target id, a non-reserved name, and at least one of label, score, or explanation.`,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  rehydratable: true,
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
  }) => {
    const session = await requireToolSession({
      toolName: ANNOTATE_TOOL_NAME,
      toolCall,
      sessionId,
      addToolOutput,
      errorText: "Cannot propose an annotation without an active session.",
    });
    if (session == null) return;
    await stageAnnotate({
      pending: {
        toolCallId: toolCall.toolCallId,
        toolName: ANNOTATE_TOOL_NAME,
        preview: input,
      },
      apply: () => applyAnnotation(input),
      addToolOutput,
      agentStore,
    });
  },
});
