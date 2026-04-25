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
 * # ID format conventions
 *
 * Two distinct ID formats appear in this file. Field names declare which
 * format is carried so the backend (and the LLM, via the system prompt) can
 * resolve them unambiguously:
 *
 * - `*NodeId`  — A Phoenix GraphQL relay [Global Object
 *   Identification](https://relay.dev/graphql/objectidentification.htm) node
 *   ID, base64-encoded. Example: `UHJvamVjdDoxMw==` (decodes to `Project:13`).
 *   These are the IDs surfaced in the URL search params (e.g.
 *   `selectedSpanNodeId`) and accepted by GraphQL `node(id:)` lookups.
 * - `otel*Id`  — An OpenTelemetry hex identifier as written by the
 *   instrumentation. Trace IDs are 32 hex chars, span IDs 16. Example:
 *   `ee6a3a45bd5f1d1e31975e8fedb97cd5`. These appear in URL route segments
 *   and on the `Trace`/`Span` GraphQL types as `traceId` / `spanId`.
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
  /** Phoenix GraphQL relay node ID (base64). */
  projectNodeId: string;
};

/** Trace the user is currently viewing (always nested under a project). */
export type AgentTraceContext = {
  type: "trace";
  /** Phoenix GraphQL relay node ID (base64). */
  projectNodeId: string;
  /** OpenTelemetry trace ID (32 hex chars). */
  otelTraceId: string;
};

/**
 * Span the user currently has selected.
 *
 * `projectNodeId` is optional because a span can be selected from views
 * outside a project route. Exactly one of `spanNodeId` (relay) or
 * `otelSpanId` (OpenTelemetry hex) is set, depending on where the selection
 * came from:
 *
 * - The `?selectedSpanNodeId=` search param flows in as `spanNodeId`.
 * - The `/playground/spans/:spanId` route segment flows in as `otelSpanId`.
 */
export type AgentSpanContext = {
  type: "span";
  /** Phoenix GraphQL relay node ID for the project (base64), if known. */
  projectNodeId?: string;
} & (
  | {
      /** Phoenix GraphQL relay node ID (base64). */
      spanNodeId: string;
      otelSpanId?: never;
    }
  | {
      /** OpenTelemetry span ID (16 hex chars). */
      otelSpanId: string;
      spanNodeId?: never;
    }
);

/** Validated span filter expression active in the project view. */
export type AgentSpanFilterContext = {
  type: "span_filter";
  /** Phoenix GraphQL relay node ID (base64). */
  projectNodeId: string;
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
      return `project:${context.projectNodeId}`;
    case "trace":
      return `trace:${context.projectNodeId}:${context.otelTraceId}`;
    case "span": {
      const project = context.projectNodeId ?? "";
      const span = context.spanNodeId
        ? `node:${context.spanNodeId}`
        : `otel:${context.otelSpanId}`;
      return `span:${project}:${span}`;
    }
    case "span_filter":
      return `span_filter:${context.projectNodeId}:${context.condition}`;
  }
}
