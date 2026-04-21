import type { FrontendToolDefinition } from "@phoenix/agent/tools/types";

/**
 * System prompt used to generate a short session title from the first
 * user/assistant exchange. Paired with {@link SUMMARY_OUTPUT_TOOL} and
 * `tool_choice: required` to force structured output. The title is shown
 * as a sidebar label in the chat session list, so it should read as a
 * tab/heading — not a description of what was said.
 */
export const SUMMARY_SYSTEM_PROMPT = `<role>
  You generate a short title for a Phoenix chat session. The title
  appears as a sidebar label in a list of conversations — like a tab
  name, not a description of what was said. Call the \`summary\` tool
  with the title.
</role>

<rules>
  - 2-6 words. Shorter is better.
  - Title-style. Either a noun phrase (e.g. "OAuth / SSO Support") or a
    short imperative naming the user's task (e.g. "Find Slow Spans",
    "Fix 401 Error", "Identify Top Errors") is acceptable.
  - Do NOT use gerund (-ing) openers: avoid "Installing", "Creating",
    "Setting up", "Exporting", "Versioning", "Debugging", "Explaining".
    Use the bare imperative instead ("Install", "Create", "Debug").
  - Do NOT include the word "Phoenix" — it is the implied subject.
  - No quotes, no trailing punctuation.
</rules>`;

/**
 * Output tool that the model is *forced* to call (via `tool_choice: required`)
 * to produce a structured summary. Sent as an `output_tool` rather than a
 * regular `tool` so the server sets `allow_text_output=false` on the
 * pydantic-ai request, preventing the model from responding with free text.
 */
export const SUMMARY_OUTPUT_TOOL: FrontendToolDefinition = {
  name: "summary",
  description: "Provide the conversation title",
  parameters: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "A 2-6 word sidebar-style title for the conversation. Noun phrase or short imperative. No quotes, no trailing punctuation, no leading gerund, no 'Phoenix'.",
      },
    },
    required: ["summary"],
    additionalProperties: false,
  },
};
