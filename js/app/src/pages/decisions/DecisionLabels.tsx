import { css } from "@emotion/react";
import { graphql, useFragment } from "react-relay";

import { Text, Token } from "@phoenix/components";
import type { DecisionLabels$key } from "@phoenix/pages/decisions/__generated__/DecisionLabels.graphql";

const ulCSS = css`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-50);
`;
export function DecisionLabels({ decision }: { decision: DecisionLabels$key }) {
  const data = useFragment<DecisionLabels$key>(
    graphql`
      fragment DecisionLabels on Decision {
        labels {
          name
          color
        }
      }
    `,
    decision
  );
  const isEmpty = data.labels.length === 0;
  if (isEmpty) {
    return <Text color="text-700">No Labels</Text>;
  }
  return (
    <ul css={ulCSS}>
      {data.labels.map((label) => (
        <li key={label.name}>
          <Token size="M" color={label.color ?? undefined}>
            {label.name}
          </Token>
        </li>
      ))}
    </ul>
  );
}
