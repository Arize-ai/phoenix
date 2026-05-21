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

function contextLabel(context: AgentContext): string {
  switch (context.type) {
    case "app":
    case "graphql":
    case "web_access":
      // Request-only runtime metadata, not user-visible page context, so it
      // should never render as a pill.
      return "";
    case "playground":
      return "Playground";
    case "project":
      return "Project";
    case "trace":
      return `Trace: ${truncateId(context.otelTraceId)}`;
    case "span": {
      const spanId = context.spanNodeId ?? context.otelSpanId;
      if (spanId == null) {
        throw new Error("span context must have spanNodeId or otelSpanId");
      }
      return `Span: ${truncateId(spanId)}`;
    }
  }
}

function toAttachmentData(context: AgentContext): AttachmentContextData {
  return {
    type: "context",
    id: agentContextKey(context),
    category: context.type,
    label: contextLabel(context),
  };
}

/**
 * Render a project's active span filter as its own pill so the user can see
 * the filter the agent is aware of, even though the filter rides as a field
 * on the project context rather than its own context type.
 */
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
    label: `Filter: ${truncate(context.spanFilter, MAX_CONDITION_CHARS)}`,
  };
}

/**
 * Renders the active agent contexts as non-removable attachments above the
 * chat input so the user can see, at a glance, what Phoenix state the agent
 * is aware of for the next turn (project, trace, selected span, active span
 * filter).
 *
 * Reads from the same `selectActiveContexts` selector used to populate the
 * chat request payload, so what the user sees is what the agent receives.
 */
export function AgentContextPills() {
  const contexts = useAgentContext(selectActiveContexts);

  if (contexts.length === 0) {
    return null;
  }

  const items = contexts.flatMap((context) => {
    if (
      context.type === "app" ||
      context.type === "graphql" ||
      context.type === "web_access"
    ) {
      return [];
    }
    const filterPill = spanFilterAttachmentData(context);
    return filterPill
      ? [toAttachmentData(context), filterPill]
      : [toAttachmentData(context)];
  });

  return (
    <Attachments variant="inline">
      {items.map((data) => (
        <Attachment key={data.id} data={data}>
          <AttachmentPreview />
          <AttachmentInfo />
        </Attachment>
      ))}
    </Attachments>
  );
}
