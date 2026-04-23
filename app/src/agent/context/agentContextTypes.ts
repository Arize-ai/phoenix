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

export function agentContextKey(context: AgentContext): string {
  switch (context.type) {
    case "project":
      return `project:${context.projectId}`;
    case "trace":
      return `trace:${context.projectId}:${context.traceId}`;
    case "span":
      return `span:${context.projectId ?? ""}:${context.spanId}`;
    case "span_filter":
      return `span_filter:${context.projectId}:${context.condition}`;
  }
}
