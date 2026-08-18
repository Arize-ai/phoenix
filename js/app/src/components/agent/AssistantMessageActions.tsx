import { isTextUIPart } from "ai";
import { type ReactNode, useState } from "react";

import {
  getAssistantMessageMetadata,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";
import { authApiFetch } from "@phoenix/api/authApiFetch";
import { MessageAction } from "@phoenix/components/ai/message/MessageAction";
import { MessageActions } from "@phoenix/components/ai/message/MessageActions";
import { MessageCopyAction } from "@phoenix/components/ai/message/MessageCopyAction";
import { MessageToolbar } from "@phoenix/components/ai/message/MessageToolbar";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useViewer } from "@phoenix/contexts/ViewerContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

/**
 * Annotation name used for PXI thumbs-up/down feedback. Written once, on the
 * turn's trace, so session view does not show the same rating twice. Matches
 * the annotation config expected by the Phoenix backend and should stay in
 * sync with any server-side consumers.
 */
const FEEDBACK_ANNOTATION_NAME = "user_feedback";

type AssistantFeedback = "positive" | "negative";

/**
 * Shape of the annotation payload sent to `/v1/trace_annotations`. Fields use
 * snake_case because that is what the REST endpoint expects on the wire.
 */
type TraceAnnotationPayload = {
  annotator_kind: "HUMAN";
  identifier: string;
  metadata: Record<string, string>;
  name: string;
  result: {
    label: AssistantFeedback;
    score: number;
  };
  trace_id: string;
};

/**
 * Concatenates all text parts of an assistant message into a single string.
 * Non-text parts (tool calls, etc.) are ignored, so the result is what a
 * human would read as the assistant's response.
 */
function getAssistantMessageText(message: AgentUIMessage) {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

/**
 * Maps a thumbs-up/thumbs-down verdict to the `{ label, score }` result shape
 * expected by the annotation API. Positive feedback scores 1, negative 0.
 */
function toFeedbackResult(feedback: AssistantFeedback) {
  return feedback === "positive"
    ? { label: "positive" as const, score: 1 }
    : { label: "negative" as const, score: 0 };
}

/**
 * Best-effort extraction of a human-readable error message from a failed
 * annotation response. Falls back to the raw body or status code if the body
 * is empty or not JSON with a `detail` field.
 */
async function getResponseErrorMessage(response: Response) {
  const text = await response.text();
  if (!text) {
    return `Request failed with status ${response.status}`;
  }
  try {
    const parsed = JSON.parse(text) as { detail?: string };
    return typeof parsed.detail === "string" ? parsed.detail : text;
  } catch {
    return text;
  }
}

/**
 * POSTs a trace-level annotation and waits for the write to complete
 * (`sync=true`) so the caller knows it was persisted. Throws with a
 * descriptive message on non-2xx responses.
 */
async function postTraceAnnotation(payload: TraceAnnotationPayload) {
  const { response } = await authApiFetch.POST("/v1/trace_annotations", {
    params: { query: { sync: true } },
    body: { data: [payload] },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

/**
 * Deletes `user_feedback` annotations with the given identifier from both the
 * span and trace annotation tables. Undo still hits both endpoints so ratings
 * written before this path was trace-only are cleaned up. The identifier is
 * scoped to a single user+message pair so `delete_all=true` only removes that
 * one annotation. Throws with a descriptive message on non-2xx responses.
 */
async function deleteAnnotations(args: {
  projectName: string;
  identifier: string;
}) {
  const { projectName, identifier } = args;
  const query = {
    name: FEEDBACK_ANNOTATION_NAME,
    identifier,
    annotator_kind: "HUMAN" as const,
    delete_all: true,
  };
  const path = { project_identifier: projectName };

  const [{ response: spanResponse }, { response: traceResponse }] =
    await Promise.all([
      authApiFetch.DELETE(
        "/v1/projects/{project_identifier}/span_annotations",
        { params: { path, query } }
      ),
      authApiFetch.DELETE(
        "/v1/projects/{project_identifier}/trace_annotations",
        { params: { path, query } }
      ),
    ]);

  if (!spanResponse.ok) {
    throw new Error(await getResponseErrorMessage(spanResponse));
  }
  if (!traceResponse.ok) {
    throw new Error(await getResponseErrorMessage(traceResponse));
  }
}

/**
 * Toolbar rendered below an assistant message with quick actions:
 *
 * - Thumbs up / thumbs down: writes a `user_feedback` annotation on the
 *   turn's trace (one write, so session view does not duplicate it with a
 *   matching root-span annotation). Clicking the active button again deletes
 *   the annotation (undo). Requires the message to carry `traceId`,
 *   `rootSpanId`, and `sessionId` metadata.
 * - Copy: copies the assistant's text response to the clipboard.
 * - Trace: opens the associated trace in a new tab. Requires `traceId`.
 *
 * `children` are rendered after the built-in actions in the same toolbar row
 * (e.g. rewind/branch controls), and force the toolbar to render even when the
 * message itself supports no built-in actions.
 *
 * The component silently renders nothing if the message has no text, no
 * metadata capable of supporting any action, and no `children`.
 */
export function AssistantMessageActions({
  message,
  children,
}: {
  message: AgentUIMessage;
  children?: ReactNode;
}) {
  const { viewer } = useViewer();
  const storeLocalTraces = useAgentContext(
    (state) => state.observability.storeLocalTraces
  );
  const assistantProjectName = useAgentContext(
    (state) => state.agentsConfig.assistantProjectName
  );
  const [selectedFeedback, setSelectedFeedback] =
    useState<AssistantFeedback | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const messageText = getAssistantMessageText(message);
  const hasMessageText = messageText.trim().length > 0;
  const metadata = getAssistantMessageMetadata(message);
  const turnTraceContext = metadata?.turnTraceContext;
  const canAnnotate = storeLocalTraces && turnTraceContext != null;
  const canOpenTrace = storeLocalTraces && turnTraceContext != null;

  if (!hasMessageText && !canAnnotate && !canOpenTrace && !children) {
    return null;
  }

  const handleOpenTrace = () => {
    if (!canOpenTrace || !turnTraceContext) {
      return;
    }
    window.open(
      prependBasename(
        `/redirects/traces/${encodeURIComponent(turnTraceContext.traceId)}`
      ),
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleFeedback = async (feedback: AssistantFeedback) => {
    if (!canAnnotate || !turnTraceContext || isSubmittingFeedback) {
      return;
    }
    const { traceId, rootSpanId } = turnTraceContext;
    const { sessionId } = metadata;
    // Combining username with message id scopes the identifier to one
    // user+message pair. Re-submitting upserts the existing record, and the
    // delete path can safely use delete_all=true without touching other messages.
    const identifier = `${viewer?.username ?? "anon"}:${message.id}`;

    setIsSubmittingFeedback(true);

    if (selectedFeedback === feedback) {
      // Undo: clicking the already-active button removes the annotation.
      try {
        await deleteAnnotations({
          projectName: assistantProjectName,
          identifier,
        });
        setSelectedFeedback(null);
      } catch {
        // Swallow errors; UI state simply won't reflect the undo.
      } finally {
        setIsSubmittingFeedback(false);
      }
      return;
    }

    const base = {
      annotator_kind: "HUMAN" as const,
      identifier,
      metadata: {
        assistant_message_id: message.id,
        feedback,
        root_span_id: rootSpanId,
        session_id: sessionId,
        trace_id: traceId,
      },
      name: FEEDBACK_ANNOTATION_NAME,
      result: toFeedbackResult(feedback),
    };

    try {
      await postTraceAnnotation({ ...base, trace_id: traceId });
      setSelectedFeedback(feedback);
    } catch {
      // Swallow errors; UI state simply won't reflect the feedback.
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <MessageToolbar>
      <MessageActions>
        {canAnnotate ? (
          <MessageAction
            label="Thumbs up"
            tooltip={
              selectedFeedback === "positive"
                ? "Undo helpful feedback"
                : "Mark this response as helpful"
            }
            isDisabled={isSubmittingFeedback}
            onPress={() => {
              void handleFeedback("positive");
            }}
          >
            <Icon
              svg={<Icons.ThumbsUp />}
              color={selectedFeedback === "positive" ? "blue-700" : "inherit"}
            />
          </MessageAction>
        ) : null}
        {canAnnotate ? (
          <MessageAction
            label="Thumbs down"
            tooltip={
              selectedFeedback === "negative"
                ? "Undo unhelpful feedback"
                : "Mark this response as unhelpful"
            }
            isDisabled={isSubmittingFeedback}
            onPress={() => {
              void handleFeedback("negative");
            }}
          >
            <Icon
              svg={<Icons.ThumbsDown />}
              color={selectedFeedback === "negative" ? "red-700" : "inherit"}
            />
          </MessageAction>
        ) : null}
        {hasMessageText ? <MessageCopyAction text={messageText} /> : null}
        {canOpenTrace ? (
          <MessageAction
            label="Trace"
            tooltip="Open the trace for this response"
            onPress={handleOpenTrace}
          >
            <Icon svg={<Icons.Trace />} />
          </MessageAction>
        ) : null}
        {children}
      </MessageActions>
    </MessageToolbar>
  );
}
