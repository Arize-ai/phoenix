import { useMemo } from "react";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import { selectActiveContexts } from "@phoenix/agent/context/selectors";
import { PromptInputContextRow } from "@phoenix/components/ai/prompt-input";
import { Badge } from "@phoenix/components/core/badge/Badge";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

const MAX_CONDITION_CHARS = 40;
const ID_PREFIX_CHARS = 8;

function truncateId(id: string): string {
  return id.length > ID_PREFIX_CHARS ? `${id.slice(0, ID_PREFIX_CHARS)}…` : id;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function contextLabel(context: AgentContext): string {
  switch (context.type) {
    case "project":
      return "Project";
    case "trace":
      return `Trace: ${truncateId(context.traceId)}`;
    case "span":
      return `Span: ${truncateId(context.spanId)}`;
    case "span_filter":
      return `Filter: ${truncate(context.condition, MAX_CONDITION_CHARS)}`;
  }
}

function contextKey(context: AgentContext): string {
  switch (context.type) {
    case "project":
      return `project:${context.projectId}`;
    case "trace":
      return `trace:${context.traceId}`;
    case "span":
      return `span:${context.spanId}`;
    case "span_filter":
      return `span_filter:${context.projectId}`;
  }
}

/**
 * Renders a pill for each active agent context so the user can see what is
 * being advertised to the backend with each chat request. Returns `null`
 * when no contexts are active.
 */
export function AgentContextPills() {
  const contexts = useAgentContext(selectActiveContexts);
  const hasContexts = contexts.length > 0;
  const pills = useMemo(
    () =>
      contexts.map((context) => (
        <Badge key={contextKey(context)} variant="info" size="S">
          {contextLabel(context)}
        </Badge>
      )),
    [contexts]
  );
  if (!hasContexts) return null;
  return <PromptInputContextRow>{pills}</PromptInputContextRow>;
}
