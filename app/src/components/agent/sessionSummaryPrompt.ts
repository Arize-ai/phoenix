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
  - Either a short noun phrase or a short imperative naming the user's
    task is acceptable.
  - Use sentence case: only the first letter of the title is
    capitalized. Proper nouns and acronyms keep their natural casing.
    Do NOT use Title Case where every major word is capitalized.
  - Do NOT start with a gerund (-ing form). Use the bare imperative
    instead.
  - Phoenix is the implied subject of every conversation, so prefer to
    omit the word "Phoenix" when the title still reads cleanly without
    it. Use it only when the title would be ambiguous or grammatically
    broken otherwise.
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
          "A 2-6 word sentence-case title for the conversation. Noun phrase or short imperative. Only the first letter capitalized; proper nouns and acronyms keep natural casing. Prefer to omit 'Phoenix' (it is implied) unless needed for clarity. No quotes, no trailing punctuation, no leading gerund.",
      },
    },
    required: ["summary"],
    additionalProperties: false,
  },
};
