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
    case "project":
      return "Project";
    case "trace":
      return `Trace: ${truncateId(context.otelTraceId)}`;
    case "span":
      return `Span: ${truncateId(context.spanNodeId ?? context.otelSpanId)}`;
    case "span_filter":
      return `Filter: ${truncate(context.condition, MAX_CONDITION_CHARS)}`;
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

  return (
    <Attachments variant="inline">
      {contexts.map((context) => {
        const data = toAttachmentData(context);
        return (
          <Attachment key={data.id} data={data}>
            <AttachmentPreview />
            <AttachmentInfo />
          </Attachment>
        );
      })}
    </Attachments>
  );
}
