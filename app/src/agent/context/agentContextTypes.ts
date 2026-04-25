/**
 * Agent context types advertised to the PXI chat agent.
 *
 * A "context" is a typed, ephemeral hint about the user's current Phoenix UI
 * state (which project/trace/span they are viewing, what span filter is
 * active). Contexts are sent with each chat turn so the agent can ground its
 * responses in what the user is actually looking at, and so the backend can
 * mount context-gated tools (e.g. `search_project` only when a project is
 * focused).
 *
 * Contexts come from two sources, both surfaced via the agent store:
 * - **Route contexts** — derived from route params by {@link
 *   ../context/AgentContextSync.AgentContextSync} on every navigation.
 * - **Mounted contexts** — advertised by feature components via {@link
 *   ../context/useAdvertiseAgentContext.useAdvertiseAgentContext} while they
 *   are rendered (e.g. a validated span filter condition).
 *
 * These are merged and deduped by
 * {@link ../context/selectors.selectActiveContexts}.
 */

/** Project the user is currently viewing. */
export type AgentProjectContext = {
  type: "project";
  projectId: string;
};

/** Trace the user is currently viewing (always nested under a project). */
export type AgentTraceContext = {
  type: "trace";
  projectId: string;
  traceId: string;
};

/**
 * Span the user currently has selected. `projectId` is optional because a
 * span can be selected from views outside a project route.
 */
export type AgentSpanContext = {
  type: "span";
  projectId?: string;
  spanId: string;
};

/** Validated span filter expression active in the project view. */
export type AgentSpanFilterContext = {
  type: "span_filter";
  projectId: string;
  condition: string;
};

/** Discriminated union of every context type the agent understands. */
export type AgentContext =
  | AgentProjectContext
  | AgentTraceContext
  | AgentSpanContext
  | AgentSpanFilterContext;

/**
 * Stable string key for an {@link AgentContext}.
 *
 * Used for React list keys and for deduping contexts that originate from both
 * the route and a mounted component (e.g. the same project appears in both).
 */
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
