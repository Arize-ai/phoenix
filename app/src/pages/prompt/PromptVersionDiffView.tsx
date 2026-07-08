import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { useTheme } from "@phoenix/contexts";

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

export function PromptVersionDiffView({
  current,
  previous,
}: {
  current: PromptVersionDiffView__template$key;
  previous: PromptVersionDiffView__template$key;
}) {
  const { theme } = useTheme();
  const currentData = useFragment(templateFragment, current);
  const previousData = useFragment(templateFragment, previous);

  const fileDiff = useMemo(() => {
    const oldText = promptTemplateToText(previousData.template);
    const newText = promptTemplateToText(currentData.template);
    return parseDiffFromFile(
      { name: "prompt.txt", contents: oldText },
      { name: "prompt.txt", contents: newText }
    );
  }, [currentData.template, previousData.template]);

  return (
    <FileDiff
      fileDiff={fileDiff}
      options={{
        diffStyle: "unified",
        disableFileHeader: true,
        theme: { light: "pierre-light", dark: "pierre-dark" },
        themeType: theme,
      }}
    />
  );
}
