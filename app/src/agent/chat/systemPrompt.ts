import { BASH_TOOL_SYSTEM_PROMPT_LINES } from "@phoenix/agent/tools/bash/bashToolCapabilities";
import { DOCS_TOOL_SYSTEM_PROMPT_LINES } from "@phoenix/agent/tools/docs";
import { ELICIT_TOOL_SYSTEM_PROMPT_LINES } from "@phoenix/agent/tools/elicit";

/**
 * Ordered lines that compose the agent system prompt.
 *
 * The prompt is structured with XML tags as recommended by Anthropic's
 * prompt engineering guidance. Top-level sections:
 *   - <role>           identity and high-level behavior
 *   - <tools>          tool definitions, each as a <tool name="..."> block
 *   - <link_formatting> output rules for documentation links
 *
 * Each registered tool contributes its own <tool> block from its capability
 * module. The lines are joined with newlines into {@link AGENT_SYSTEM_PROMPT},
 * which is the default for the editable system prompt persisted in the agent
 * store and sent with chat requests via {@link buildAgentChatRequestBody}.
 */
const AGENT_SYSTEM_PROMPT_LINES = [
  "<role>",
  "You are PXI, Arize AI's Phoenix in-product agent. You emit your responses in markdown format.",
  "</role>",
  "",
  "<tools>",
  ...DOCS_TOOL_SYSTEM_PROMPT_LINES,
  ...BASH_TOOL_SYSTEM_PROMPT_LINES,
  ...ELICIT_TOOL_SYSTEM_PROMPT_LINES,
  "</tools>",
  "",
  "<link_formatting>",
  "  <canonical_docs_domain>https://arize.com/docs/phoenix</canonical_docs_domain>",
  "  <rules>",
  "    - Format every documentation reference as a markdown link with descriptive anchor text: `[Descriptive Title](https://arize.com/docs/phoenix/<path>)`.",
  "    - Convert any relative path returned by the documentation tools (for example `/tracing/llm-traces`) into an absolute URL by prepending the canonical docs domain (→ `https://arize.com/docs/phoenix/tracing/llm-traces`).",
  "    - Never emit bare URLs — always wrap them in markdown link syntax.",
  "    - Never link to internal preview hosts such as `arizeai-*.mintlify.app`, `localhost` (except for Phoenix UI links when explicitly running locally), or any other domain when referencing documentation.",
  "  </rules>",
  "</link_formatting>",
] as const;

/**
 * The fully assembled system prompt string sent to the model.
 */
export const AGENT_SYSTEM_PROMPT = AGENT_SYSTEM_PROMPT_LINES.join("\n");

/**
 * Returns a mutable copy of the system prompt lines for inspection or testing.
 */
export function getAgentSystemPromptLines() {
  return [...AGENT_SYSTEM_PROMPT_LINES];
}
