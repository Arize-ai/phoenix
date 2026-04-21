import type { FrontendToolDefinition } from "@phoenix/agent/tools/types";

/**
 * System prompt used to generate a 5-10 word session summary from the first
 * user/assistant exchange. Paired with {@link SUMMARY_OUTPUT_TOOL} and
 * `tool_choice: required` to force structured output.
 */
export const SUMMARY_SYSTEM_PROMPT =
  "You are a concise summarizer. You MUST call the `summary` tool with a 5-10 word summary of the conversation topic. No quotes, no punctuation at the end.";

/**
 * Output tool that the model is *forced* to call (via `tool_choice: required`)
 * to produce a structured summary. Sent as an `output_tool` rather than a
 * regular `tool` so the server sets `allow_text_output=false` on the
 * pydantic-ai request, preventing the model from responding with free text.
 */
export const SUMMARY_OUTPUT_TOOL: FrontendToolDefinition = {
  name: "summary",
  description: "Provide the conversation summary",
  parameters: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "A 5-10 word summary of the conversation topic",
      },
    },
    required: ["summary"],
    additionalProperties: false,
  },
};
