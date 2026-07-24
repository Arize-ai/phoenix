import type { CSSProperties } from "react";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import { agentContextKey } from "@phoenix/agent/context/agentContextTypes";
import { selectActiveContexts } from "@phoenix/agent/context/selectors";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  Attachments,
} from "@phoenix/components/ai/attachment";
import type { AttachmentContextData } from "@phoenix/components/ai/attachment";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { assertUnreachable } from "@phoenix/typeUtils";

const MAX_CONDITION_CHARS = 40;
const ID_PREFIX_CHARS = 8;

function truncateId(id: string): string {
  return id.length > ID_PREFIX_CHARS
    ? `${id.slice(0, ID_PREFIX_CHARS)}...`
    : id;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

/** The context type, shown as the chip's always-visible label. */
function contextLabel(context: AgentContext): string {
  switch (context.type) {
    case "app":
    case "graphql":
    case "web_access":
    case "subagents":
      // Request-only runtime metadata, not user-visible page context, so it
      // should never render as a pill.
      return "";
    case "playground":
      return "Playground";
    case "project":
      return "Project";
    case "trace":
      return "Trace";
    case "session":
      return "Session";
    case "prompt":
      return "Prompt";
    case "prompt_version":
      return "Prompt Version";
    case "span":
      return "Span";
    case "code_evaluator":
      return "Code Evaluator";
    case "llm_evaluator":
      return "LLM Evaluator";
    case "dataset":
      return "Dataset";
    default:
      return assertUnreachable(context);
  }
}

/** The id shown dimmed beside the label, or undefined when there is none. */
function contextDetail(context: AgentContext): string | undefined {
  switch (context.type) {
    case "trace":
      return truncateId(context.otelTraceId);
    case "session":
      return truncateId(context.sessionNodeId);
    case "prompt":
      return truncateId(context.promptNodeId);
    case "prompt_version":
      return truncateId(context.promptVersionNodeId);
    case "span": {
      const spanId = context.spanNodeId ?? context.otelSpanId;
      if (spanId == null) {
        throw new Error("span context must have spanNodeId or otelSpanId");
      }
      return truncateId(spanId);
    }
    case "code_evaluator":
    case "llm_evaluator":
      return context.evaluatorNodeId
        ? `Editing evaluator: ${truncateId(context.evaluatorNodeId)}`
        : "New evaluator";
    case "dataset":
      return truncateId(context.datasetNodeId);
    default:
      return undefined;
  }
}

function toAttachmentData(context: AgentContext): AttachmentContextData {
  return {
    type: "context",
    id: agentContextKey(context),
    category: context.type,
    label: contextLabel(context),
    detail: contextDetail(context),
  };
}

function spanFilterAttachmentData(
  context: AgentContext
): AttachmentContextData | null {
  if (context.type !== "project" || !context.spanFilter) {
    return null;
  }
  const id = `${agentContextKey(context)}:span_filter`;
  return {
    type: "context",
    id,
    category: "span_filter",
    label: "Filter",
    detail: truncate(context.spanFilter, MAX_CONDITION_CHARS),
  };
}

export function AgentContextPills() {
  const contexts = useAgentContext(selectActiveContexts);

  if (contexts.length === 0) {
    return null;
  }

  const items = contexts.flatMap((context) => {
    if (
      context.type === "app" ||
      context.type === "graphql" ||
      context.type === "web_access" ||
      context.type === "subagents"
    ) {
      return [];
    }
    const filterPill = spanFilterAttachmentData(context);
    return filterPill
      ? [toAttachmentData(context), filterPill]
      : [toAttachmentData(context)];
  });

  if (items.length === 0) {
    return null;
  }

  // The pills sit on the prompt input surface; match the stack seam to it.
  const attachmentsStyle: CSSProperties & Record<`--${string}`, string> = {
    "--attachment-stack-separator-color":
      "var(--prompt-input-background-color)",
  };

  return (
    <Attachments variant="inline" collapsible style={attachmentsStyle}>
      {items.map((data) => (
        <Attachment key={data.id} data={data}>
          <AttachmentPreview />
          <AttachmentInfo />
        </Attachment>
      ))}
    </Attachments>
  );
}
