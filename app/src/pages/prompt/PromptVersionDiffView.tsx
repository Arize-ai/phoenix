import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { useTheme } from "@phoenix/contexts";
import { promptTemplateToText } from "@phoenix/utils/promptTemplateText";

import type { PromptVersionDiffView__template$key } from "./__generated__/PromptVersionDiffView__template.graphql";

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
