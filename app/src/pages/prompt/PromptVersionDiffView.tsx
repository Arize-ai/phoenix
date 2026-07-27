import { graphql, useFragment } from "react-relay";

import type { TextDiffStyle } from "@phoenix/components/diff";
import { TextDiff } from "@phoenix/components/diff";

import type {
  PromptVersionDiffView__template$data,
  PromptVersionDiffView__template$key,
} from "./__generated__/PromptVersionDiffView__template.graphql";

type Template = PromptVersionDiffView__template$data["template"];

function promptTemplateToText(template: Template): string {
  if (template.__typename === "PromptStringTemplate") {
    return template.template;
  }
  if (template.__typename === "PromptChatTemplate") {
    return template.messages
      .map((message) => {
        const role = `[${message.role}]`;
        const parts = message.content
          .map((part) => {
            if (part.__typename === "TextContentPart") {
              return part.text.text;
            }
            if (part.__typename === "ToolCallContentPart") {
              const toolCallFunction = part.toolCall.toolCall;
              return `[tool_call] ${toolCallFunction.name}(${toolCallFunction.arguments})`;
            }
            if (part.__typename === "ToolResultContentPart") {
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
  return "";
}

const templateFragment = graphql`
  fragment PromptVersionDiffView__template on PromptVersion {
    template {
      __typename
      ... on PromptChatTemplate {
        messages {
          role
          content {
            __typename
            ... on TextContentPart {
              text {
                text
              }
            }
            ... on ToolCallContentPart {
              toolCall {
                toolCallId
                toolCall {
                  arguments
                  name
                }
              }
            }
            ... on ToolResultContentPart {
              toolResult {
                toolCallId
                result
              }
            }
          }
        }
      }
      ... on PromptStringTemplate {
        template
      }
    }
  }
`;

/**
 * A git-like diff of the prompt template (chat messages) between two prompt
 * versions.
 */
export function PromptVersionDiffView({
  current,
  baseline,
  diffStyle = "unified",
}: {
  current: PromptVersionDiffView__template$key;
  baseline: PromptVersionDiffView__template$key;
  diffStyle?: TextDiffStyle;
}) {
  const currentData = useFragment(templateFragment, current);
  const baselineData = useFragment(templateFragment, baseline);

  return (
    <TextDiff
      oldText={promptTemplateToText(baselineData.template)}
      newText={promptTemplateToText(currentData.template)}
      fileName="prompt.txt"
      diffStyle={diffStyle}
    />
  );
}
