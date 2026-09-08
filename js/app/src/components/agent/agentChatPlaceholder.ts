import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";

export const COMPACTION_PLACEHOLDER_TOKEN_THRESHOLD = 100_000;

const DEFAULT_PLACEHOLDER = "Send a message";
const COMPACTION_PLACEHOLDER = "Try /compact to save tokens";
const DEBUG_SPAN_PLACEHOLDER = "Try /debug-trace to understand this span";
const DEBUG_TRACE_PLACEHOLDER = "Try /debug-trace to understand this trace";
const DEBUG_PROJECT_PLACEHOLDER = "Try /debug-trace to find failure patterns";
const PLAYGROUND_PLACEHOLDER = "Try /playground to improve this prompt";
const EVALUATOR_PLACEHOLDER = "Try /evaluators to refine this evaluator";

export type AgentChatSuggestionContext = AgentContext["type"] | null;

/**
 * Select the most relevant teaching placeholder for the PXI composer.
 *
 * Empty conversations retain the neutral prompt. Once a conversation has
 * started, compaction takes priority over contextual skill suggestions because
 * it addresses an immediate context-window concern. Skill suggestions are only
 * shown when the advertised skill catalog confirms that the skill is available.
 */
export function getAgentChatPlaceholder({
  hasMessages,
  promptTokenCount,
  suggestionContext,
  availableSkillNames,
}: {
  hasMessages: boolean;
  promptTokenCount: number | null;
  suggestionContext: AgentChatSuggestionContext;
  availableSkillNames: ReadonlySet<string>;
}): string {
  if (!hasMessages) {
    return DEFAULT_PLACEHOLDER;
  }
  if (
    promptTokenCount != null &&
    promptTokenCount >= COMPACTION_PLACEHOLDER_TOKEN_THRESHOLD
  ) {
    return COMPACTION_PLACEHOLDER;
  }
  switch (suggestionContext) {
    case "span":
      return availableSkillNames.has("debug-trace")
        ? DEBUG_SPAN_PLACEHOLDER
        : DEFAULT_PLACEHOLDER;
    case "trace":
      return availableSkillNames.has("debug-trace")
        ? DEBUG_TRACE_PLACEHOLDER
        : DEFAULT_PLACEHOLDER;
    case "project":
      return availableSkillNames.has("debug-trace")
        ? DEBUG_PROJECT_PLACEHOLDER
        : DEFAULT_PLACEHOLDER;
    case "playground":
      return availableSkillNames.has("playground")
        ? PLAYGROUND_PLACEHOLDER
        : DEFAULT_PLACEHOLDER;
    case "code_evaluator":
    case "llm_evaluator":
      return availableSkillNames.has("evaluators")
        ? EVALUATOR_PLACEHOLDER
        : DEFAULT_PLACEHOLDER;
    default:
      return DEFAULT_PLACEHOLDER;
  }
}
