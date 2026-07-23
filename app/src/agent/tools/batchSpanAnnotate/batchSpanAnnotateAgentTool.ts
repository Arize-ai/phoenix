import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { requireToolSession } from "@phoenix/agent/extensions/registry/requireToolSession";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

import { applySpanAnnotations } from "./applySpanAnnotations";
import { BATCH_SPAN_ANNOTATE_TOOL_NAME } from "./constants";
import { parseBatchSpanAnnotateInput } from "./parsers";
import { bindPendingBatchSpanAnnotateActions } from "./pendingBatchSpanAnnotate";
import type {
  BatchSpanAnnotateActionContext,
  BatchSpanAnnotateInput,
} from "./types";

/**
 * Proposes a batch of span annotations as a pending change. Auto-applies when
 * edit approvals are bypassed; otherwise stores the proposal for the UI to
 * accept or reject. Requires an active session to attribute the change.
 */
export const batchSpanAnnotateAgentTool = defineTool<BatchSpanAnnotateInput>({
  name: BATCH_SPAN_ANNOTATE_TOOL_NAME,
  parseInput: parseBatchSpanAnnotateInput,
  invalidInputErrorText: (input) =>
    isPlainObject(input) && Object.keys(input).length === 0
      ? `${BATCH_SPAN_ANNOTATE_TOOL_NAME} needs an annotations array. Call it with { annotations: [{ spanId or spanNodeId, name, and at least one of label, score, or explanation }] }. Do not call this tool until you have a real span id and annotation value.`
      : `Invalid ${BATCH_SPAN_ANNOTATE_TOOL_NAME} input. Expected { annotations: { spanId?: string, spanNodeId?: string, name: string, annotatorKind?: "LLM" | "HUMAN" | "CODE", label?: string | null, score?: number | null, explanation?: string | null, identifier?: string | null, metadata?: object | null }[] }. Each annotation requires exactly one of spanId or spanNodeId, a non-reserved name, and at least one of label, score, or explanation.`,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
  }) => {
    const session = await requireToolSession({
      toolName: BATCH_SPAN_ANNOTATE_TOOL_NAME,
      toolCall,
      sessionId,
      addToolOutput,
      errorText: "Cannot propose span annotations without an active session.",
    });
    if (session == null) return;
    const context: BatchSpanAnnotateActionContext = {
      toolCallId: toolCall.toolCallId,
      sessionId: session,
      addToolOutput,
    };
    const pendingAnnotation = bindPendingBatchSpanAnnotateActions({
      pendingAnnotation: {
        toolCallId: context.toolCallId,
        sessionId: context.sessionId,
        annotations: input,
      },
      applyAnnotations: applySpanAnnotations,
      addToolOutput: context.addToolOutput,
      setPendingBatchSpanAnnotate:
        agentStore.getState().setPendingBatchSpanAnnotate,
    });

    if (agentStore.getState().permissions.edits === "bypass") {
      await pendingAnnotation.accept?.({ approvalSource: "auto" });
      return;
    }

    agentStore
      .getState()
      .setPendingBatchSpanAnnotate(toolCall.toolCallId, pendingAnnotation);
  },
});
