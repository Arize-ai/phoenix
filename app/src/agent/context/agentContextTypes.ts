import type { components } from "@phoenix/api/__generated__/v1";
import { assertUnreachable } from "@phoenix/typeUtils";

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
 * Two distinct ID formats appear on context payloads. Field names declare
 * which format is carried so the backend (and the LLM, via the system
 * prompt) can resolve them unambiguously:
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

/** Discriminated union of every context type the agent understands. */
export type AgentContext = components["schemas"]["ChatContext"];

/**
 * Stable string key for an {@link AgentContext}.
 *
 * Used for React list keys and for deduping contexts that originate from both
 * the route and a mounted component (e.g. the same project appears in both).
 */
export function agentContextKey(context: AgentContext): string {
  switch (context.type) {
    case "app":
      return "app";
    case "playground":
      return "playground";
    case "code_evaluator":
      return context.evaluatorNodeId
        ? `code_evaluator:${context.evaluatorNodeId}`
        : "code_evaluator:create";
    case "llm_evaluator":
      return context.evaluatorNodeId
        ? `llm_evaluator:${context.evaluatorNodeId}`
        : "llm_evaluator:create";
    case "dataset":
      return context.datasetVersionNodeId
        ? `dataset:${context.datasetNodeId}:${context.datasetVersionNodeId}`
        : `dataset:${context.datasetNodeId}`;
    case "project":
      return `project:${context.projectNodeId}`;
    case "trace":
      return `trace:${context.projectNodeId}:${context.otelTraceId}`;
    case "session":
      return `session:${context.projectNodeId}:${context.sessionNodeId}`;
    case "prompt":
      return `prompt:${context.promptNodeId}`;
    case "prompt_version":
      return `prompt_version:${context.promptNodeId}:${context.promptVersionNodeId}`;
    case "span": {
      const project = context.projectNodeId ?? "";
      const span = context.spanNodeId
        ? `node:${context.spanNodeId}`
        : `otel:${context.otelSpanId}`;
      return `span:${project}:${span}`;
    }
    case "graphql":
      return "graphql";
    case "web_access":
      return "web_access";
    case "subagents":
      return "subagents";
    default:
      return assertUnreachable(context);
  }
}
