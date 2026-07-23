import { Icons } from "@phoenix/components";
import {
  DEFAULT_QUICK_ACTIONS,
  type EmptyStateQuickAction,
} from "@phoenix/components/agent/ChatEmptyState";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import type { AgentState } from "@phoenix/store/agentStore";

import type { AgentContext } from "../context/agentContextTypes";
import { selectActiveContexts } from "../context/selectors";

type AgentContextType = AgentContext["type"];

/**
 * Maximum number of quick actions surfaced in the empty state. Page contexts
 * can contribute more than this between them; we cap so the empty state stays
 * scannable and keep only the most useful suggestions, drawn from the most
 * specific context first.
 */
const MAX_QUICK_ACTIONS = 3;

/**
 * Specificity ranking for the page-level contexts the assistant advertises. When several
 * contexts are active at once (e.g. a span is selected inside a project), the
 * more specific context's suggestions are surfaced first because they map to
 * the narrowest, most actionable set of tools. Contexts absent from this list
 * (`app`, `graphql`, `web_access`) are request-only runtime metadata and
 * contribute no page-level suggestions.
 */
const CONTEXT_SPECIFICITY: AgentContextType[] = [
  "span",
  "trace",
  "session",
  "project",
  "playground",
];

/**
 * Quick actions contributed by each page-level agent context. The active set is
 * derived from whatever contexts the assistant is currently advertising, so the
 * suggestions track the tools available where the user actually is in the UI:
 * the playground exposes prompt/run actions, a project exposes trace triage and
 * filtering, and so on. The tool that backs each prompt is gated server-side by
 * the same context, so a suggestion only appears when its tools are available.
 */
const QUICK_ACTIONS_BY_CONTEXT: Partial<
  Record<AgentContextType, EmptyStateQuickAction[]>
> = {
  playground: [
    {
      icon: <Icons.Edit />,
      label: "Enhance the prompt",
      prompt:
        "Improve the prompt in the playground to be clearer and more effective.",
    },
    {
      icon: <Icons.PlayCircle />,
      label: "Run the playground",
      prompt: "Run the playground and summarize the results.",
    },
    {
      icon: <Icons.Code />,
      label: "Fill in variables",
      prompt: "Fill in the playground variables with realistic test values.",
    },
  ],
  project: [
    {
      icon: <Icons.Trace />,
      label: "Find critical issues",
      prompt: "Find critical issues in my traces.",
    },
    {
      icon: <Icons.ListFilter />,
      label: "Filter to errors",
      prompt: "Filter the spans to show only the ones with errors.",
    },
    {
      icon: <Icons.Search />,
      label: "Search this project",
      prompt: "Search this project for spans related to a topic I describe.",
    },
  ],
  trace: [
    {
      icon: <Icons.Book />,
      label: "Explain this trace",
      prompt: "Explain what happened in this trace.",
    },
    {
      icon: <Icons.Trace />,
      label: "Find what went wrong",
      prompt: "Find what went wrong in this trace.",
    },
  ],
  session: [
    {
      icon: <Icons.MessageSquare />,
      label: "Summarize this session",
      prompt: "Summarize what happened in this session.",
    },
    {
      icon: <Icons.Trace />,
      label: "Find session issues",
      prompt: "Find the most important issues in this session.",
    },
  ],
  span: [
    {
      icon: <Icons.Bulb />,
      label: "Explain this span",
      prompt: "Explain what this span is doing.",
    },
    {
      icon: <Icons.Search />,
      label: "Debug this span",
      prompt: "Help me debug this span.",
    },
  ],
};

/**
 * Build the quick actions for a set of active page-context types.
 *
 * Contexts are visited most-specific first so the narrowest suggestions lead;
 * actions are deduped by label and capped at {@link MAX_QUICK_ACTIONS}. When no
 * active context contributes anything, the generic {@link DEFAULT_QUICK_ACTIONS}
 * are returned so the empty state is never blank.
 */
export function buildAgentQuickActions(
  contextTypes: readonly string[]
): EmptyStateQuickAction[] {
  const present = new Set(contextTypes);
  const actions: EmptyStateQuickAction[] = [];
  const seenLabels = new Set<string>();

  for (const contextType of CONTEXT_SPECIFICITY) {
    if (!present.has(contextType)) {
      continue;
    }
    for (const action of QUICK_ACTIONS_BY_CONTEXT[contextType] ?? []) {
      if (seenLabels.has(action.label)) {
        continue;
      }
      seenLabels.add(action.label);
      actions.push(action);
      if (actions.length >= MAX_QUICK_ACTIONS) {
        return actions;
      }
    }
  }

  return actions.length > 0 ? actions : DEFAULT_QUICK_ACTIONS;
}

/**
 * Stable, comma-joined key of the distinct active context types. Subscribing to
 * this string (rather than the context array, which is a fresh reference on
 * every store update) keeps the chat view from re-rendering on unrelated agent
 * state changes such as streaming tokens.
 */
function selectActiveContextKey(state: AgentState): string {
  const seen = new Set<AgentContextType>();
  for (const context of selectActiveContexts(state)) {
    seen.add(context.type);
  }
  return Array.from(seen).sort().join(",");
}

/**
 * Quick actions tailored to the agent contexts the assistant is currently advertising for
 * the active route/page. Returns the generic defaults when the page advertises
 * no actionable context.
 */
export function useAgentQuickActions(): EmptyStateQuickAction[] {
  const contextKey = useAgentContext(selectActiveContextKey);
  return buildAgentQuickActions(contextKey ? contextKey.split(",") : []);
}
