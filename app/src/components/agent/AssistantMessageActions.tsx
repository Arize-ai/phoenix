import { isTextUIPart } from "ai";
import copy from "copy-to-clipboard";
import { useState } from "react";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { authFetch } from "@phoenix/authFetch";
import { Icon, Icons } from "@phoenix/components";
import {
  MessageAction,
  MessageActions,
  MessageToolbar,
} from "@phoenix/components/ai/message";
import { useViewer } from "@phoenix/contexts";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

/**
 * Annotation name used for both span- and trace-level user feedback on
 * assistant messages. Matches the annotation config expected by the Phoenix
 * backend and should stay in sync with any server-side consumers.
 */
const FEEDBACK_ANNOTATION_NAME = "user_feedback";

type AssistantFeedback = "positive" | "negative";

/**
 * Shared shape of the annotation payload sent to the Phoenix REST API. Fields
 * use snake_case because that is what the `/v1/*_annotations` endpoints
 * expect on the wire.
 */
type AnnotationPayloadBase = {
  annotator_kind: "HUMAN";
  identifier: string;
  metadata: Record<string, string>;
  name: string;
  result: {
    label: AssistantFeedback;
    score: number;
  };
};

type SpanAnnotationPayload = AnnotationPayloadBase & { span_id: string };
type TraceAnnotationPayload = AnnotationPayloadBase & { trace_id: string };

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
 * POSTs a single annotation to the given Phoenix endpoint and waits for the
 * write to complete (`sync=true`) so the caller knows it was persisted.
 * Throws with a descriptive message on non-2xx responses.
 */
async function postAnnotation({
  endpoint,
  payload,
}: {
  endpoint: "/v1/span_annotations" | "/v1/trace_annotations";
  payload: SpanAnnotationPayload | TraceAnnotationPayload;
}) {
  const response = await authFetch(`${prependBasename(endpoint)}?sync=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: [payload] }),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

/**
 * Toolbar rendered below an assistant message with quick actions:
 *
 * - Thumbs up / thumbs down: writes a `user_feedback` annotation to both the
 *   root span and the trace. Requires the message to carry `traceId`,
 *   `rootSpanId`, and `sessionId` metadata.
 * - Copy: copies the assistant's text response to the clipboard.
 * - Trace: opens the associated trace in a new tab. Requires `traceId`.
 *
 * The component silently renders nothing if the message has no text and no
 * metadata capable of supporting any action.
 */
export function AssistantMessageActions({
  message,
}: {
  message: AgentUIMessage;
}) {
  const { viewer } = useViewer();
  const storeLocalTraces = useAgentContext(
    (state) => state.observability.storeLocalTraces
  );
  const [selectedFeedback, setSelectedFeedback] =
    useState<AssistantFeedback | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const messageText = getAssistantMessageText(message);
  const hasMessageText = messageText.trim().length > 0;
  const metadata = message.metadata;
  const canAnnotate =
    storeLocalTraces &&
    typeof metadata?.traceId === "string" &&
    typeof metadata?.rootSpanId === "string" &&
    typeof metadata?.sessionId === "string";
  const canOpenTrace =
    storeLocalTraces && typeof metadata?.traceId === "string";

  if (!hasMessageText && !canAnnotate && !canOpenTrace) {
    return null;
  }

  const handleCopy = () => {
    if (!hasMessageText) {
      return;
    }
    copy(messageText);
  };

  const handleOpenTrace = () => {
    if (!canOpenTrace || !metadata) {
      return;
    }
    window.open(
      prependBasename(`/redirects/traces/${metadata.traceId}`),
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleFeedback = async (feedback: AssistantFeedback) => {
    if (!canAnnotate || !metadata || isSubmittingFeedback) {
      return;
    }
    if (selectedFeedback === feedback) {
      return;
    }

    setIsSubmittingFeedback(true);
    // Using the username as the identifier makes feedback per-user: the same
    // user re-submitting updates their entry, while different users produce
    // distinct annotation records. Anonymous viewers fall back to the message
    // id, which still deduplicates against the same message.
    const identifier = viewer?.username ?? message.id;
    const base = {
      annotator_kind: "HUMAN" as const,
      identifier,
      metadata: {
        assistant_message_id: message.id,
        feedback,
        root_span_id: metadata.rootSpanId,
        session_id: metadata.sessionId,
        trace_id: metadata.traceId,
      },
      name: FEEDBACK_ANNOTATION_NAME,
      result: toFeedbackResult(feedback),
    };

    try {
      await Promise.all([
        postAnnotation({
          endpoint: "/v1/span_annotations",
          payload: { ...base, span_id: metadata.rootSpanId },
        }),
        postAnnotation({
          endpoint: "/v1/trace_annotations",
          payload: { ...base, trace_id: metadata.traceId },
        }),
      ]);
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
            tooltip="Mark this response as helpful"
            isDisabled={isSubmittingFeedback}
            onPress={() => {
              void handleFeedback("positive");
            }}
          >
            <Icon
              svg={<Icons.ThumbsUpOutline />}
              color={selectedFeedback === "positive" ? "blue-700" : "inherit"}
            />
          </MessageAction>
        ) : null}
        {canAnnotate ? (
          <MessageAction
            label="Thumbs down"
            tooltip="Mark this response as unhelpful"
            isDisabled={isSubmittingFeedback}
            onPress={() => {
              void handleFeedback("negative");
            }}
          >
            <Icon
              svg={<Icons.ThumbsDownOutline />}
              color={selectedFeedback === "negative" ? "red-700" : "inherit"}
            />
          </MessageAction>
        ) : null}
        {hasMessageText ? (
          <MessageAction
            label="Copy"
            tooltip="Copy this response"
            onPress={handleCopy}
          >
            <Icon svg={<Icons.DuplicateOutline />} />
          </MessageAction>
        ) : null}
        {canOpenTrace ? (
          <MessageAction
            label="Trace"
            tooltip="Open the trace for this response"
            onPress={handleOpenTrace}
          >
            <Icon svg={<Icons.Trace />} />
          </MessageAction>
        ) : null}
      </MessageActions>
    </MessageToolbar>
  );
}
