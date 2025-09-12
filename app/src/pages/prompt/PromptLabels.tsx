import { graphql, useFragment } from "react-relay";

import { Text, Token } from "@phoenix/components";
import { PromptLabels$key } from "@phoenix/pages/prompt/__generated__/PromptLabels.graphql";

export function PromptLabels({ prompt }: { prompt: PromptLabels$key }) {
  const data = useFragment<PromptLabels$key>(
    graphql`
      fragment PromptLabels on Prompt {
        labels {
          name
          color
        }
      }
    `,
    prompt
  );
  const isEmpty = data.labels.length === 0;
  if (isEmpty) {
    return <Text color="text-700">No Labels</Text>;
  }
  return (
    <ul>
      {data.labels.map((label) => (
        <li key={label.name}>
          <Token size="M" color={label.color}>
            {label.name}
          </Token>
        </li>
      ))}
    </ul>
  );
}
