/**
 * Wire-protocol types for the contexts the frontend advertises to the
 * `/chat` endpoint. The string literals used as the `type` discriminator
 * must stay in sync with the Python discriminators defined in
 * `src/phoenix/server/api/routers/chat_context.py`.
 */

export type AgentProjectContext = {
  type: "project";
  projectId: string;
};

export type AgentTraceContext = {
  type: "trace";
  projectId: string;
  traceId: string;
};

export type AgentSpanContext = {
  type: "span";
  projectId?: string;
  spanId: string;
};

export type AgentSpanFilterContext = {
  type: "span_filter";
  projectId: string;
  condition: string;
};

export type AgentContext =
  | AgentProjectContext
  | AgentTraceContext
  | AgentSpanContext
  | AgentSpanFilterContext;

export type AgentContextType = AgentContext["type"];

/**
 * Stable key identifying a context for deduplication and shallow diffing.
 * Two contexts with the same key refer to the same logical entity.
 */
export function agentContextKey(context: AgentContext): string {
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
