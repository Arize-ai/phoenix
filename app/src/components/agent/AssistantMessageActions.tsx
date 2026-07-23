import { isTextUIPart } from "ai";
import { type ReactNode, useState } from "react";

import {
  getAssistantMessageMetadata,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";
import { authApiFetch } from "@phoenix/api/authApiFetch";
import { MessageAction } from "@phoenix/components/ai/message/MessageAction";
import { MessageActions } from "@phoenix/components/ai/message/MessageActions";
import { MessageToolbar } from "@phoenix/components/ai/message/MessageToolbar";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useViewer } from "@phoenix/contexts/ViewerContext";
import { isPlainObject } from "@phoenix/utils/jsonUtils";
import { prependBasename } from "@phoenix/utils/routingUtils";

import { MessageCopyAction } from "./MessageCopyAction";

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
    const parsed: unknown = JSON.parse(text);
    return isPlainObject(parsed) && typeof parsed.detail === "string"
      ? parsed.detail
      : text;
  } catch {
    return text;
  }
}

/**
 * POSTs a single annotation to the given Phoenix endpoint and waits for the
 * write to complete (`sync=true`) so the caller knows it was persisted.
 * Throws with a descriptive message on non-2xx responses.
 */
async function postAnnotation(
  args:
    | { endpoint: "/v1/span_annotations"; payload: SpanAnnotationPayload }
    | { endpoint: "/v1/trace_annotations"; payload: TraceAnnotationPayload }
) {
  const params = { query: { sync: true } } as const;
  const { response } =
    args.endpoint === "/v1/span_annotations"
      ? await authApiFetch.POST("/v1/span_annotations", {
          params,
          body: { data: [args.payload] },
        })
      : await authApiFetch.POST("/v1/trace_annotations", {
          params,
          body: { data: [args.payload] },
        });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

/**
 * Deletes `user_feedback` annotations with the given identifier from both the
 * span and trace annotation tables. Used to undo a previously submitted
 * thumbs-up/down. The identifier is scoped to a single user+message pair so
 * `delete_all=true` only removes that one annotation.
 * Throws with a descriptive message on non-2xx responses.
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
 * - Thumbs up / thumbs down: writes a `user_feedback` annotation to both the
 *   root span and the trace. Clicking the active button again deletes the
 *   annotation (undo). Requires the message to carry `traceId`, `rootSpanId`,
 *   and `sessionId` metadata.
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
  const canAnnotate = storeLocalTraces && metadata?.trace != null;
  const canOpenTrace = storeLocalTraces && metadata?.trace != null;

  if (!hasMessageText && !canAnnotate && !canOpenTrace && !children) {
    return null;
  }

  const handleOpenTrace = () => {
    if (!canOpenTrace || !metadata?.trace) {
      return;
    }
    window.open(
      prependBasename(
        `/redirects/traces/${encodeURIComponent(metadata.trace.traceId)}`
      ),
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleFeedback = async (feedback: AssistantFeedback) => {
    if (!canAnnotate || !metadata?.trace || isSubmittingFeedback) {
      return;
    }
    const { traceId, rootSpanId } = metadata.trace;
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
      await Promise.all([
        postAnnotation({
          endpoint: "/v1/span_annotations",
          payload: { ...base, span_id: rootSpanId },
        }),
        postAnnotation({
          endpoint: "/v1/trace_annotations",
          payload: { ...base, trace_id: traceId },
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
