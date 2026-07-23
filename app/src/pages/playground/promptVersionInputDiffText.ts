import type { ChatPromptVersionInput } from "./__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";

/**
 * Serializes the chat template (messages) of a prompt version input to plain
 * text for line-based diffing. Mirrors the text format used by the prompt
 * version diff view.
 */
export function chatPromptVersionInputToTemplateText(
  input: ChatPromptVersionInput
): string {
  return input.template.messages
    .map((message) => {
      const role = `[${message.role}]`;
      const parts = message.content
        .map((part) => {
          if (part.text != null) {
            return part.text.text;
          }
          if (part.toolCall != null) {
            const toolCallFunction = part.toolCall.toolCall;
            return `[tool_call] ${toolCallFunction.name}(${toolCallFunction.arguments})`;
          }
          if (part.toolResult != null) {
            const result =
              typeof part.toolResult.result === "string"
                ? part.toolResult.result
                : JSON.stringify(part.toolResult.result, null, 2);
            return `[tool_result] ${part.toolResult.toolCallId}: ${result}`;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
      return `${role}\n${parts}`;
    })
    .join("\n\n");
}

/**
 * Serializes the model configuration of a prompt version input (model,
 * invocation parameters, tools, response format) to stable, pretty-printed
 * JSON for line-based diffing.
 */
export function chatPromptVersionInputToConfigText(
  input: ChatPromptVersionInput
): string {
  const { openai, anthropic, google, aws } = input.invocationParameters;
  const config = {
    provider: input.modelProvider,
    model: input.modelName,
    template_format: input.templateFormat,
    invocation_parameters: openai ?? anthropic ?? google ?? aws ?? {},
    tools: input.tools ?? null,
    response_format: input.responseFormat ?? null,
  };
  return JSON.stringify(config, null, 2);
}
