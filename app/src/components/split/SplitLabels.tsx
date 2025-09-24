import { css } from "@emotion/react";

import { Text, Token } from "@phoenix/components";

const ulCSS = css`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--ac-global-dimension-size-50);
`;

export type SplitLabel = {
  readonly name: string;
  readonly color: string;
  readonly id: string;
};

export function SplitLabels({ labels }: { labels: readonly SplitLabel[] }) {
  const isEmpty = !labels || labels.length === 0;
  if (isEmpty) {
    return <Text color="text-700">No Splits</Text>;
  }
  return (
    <ul css={ulCSS}>
      {labels.map((label) => (
        <li key={`${label.name}-${label.color ?? "none"}`}>
          <Token size="M" color={label.color ?? undefined}>
            {label.name}
          </Token>
        </li>
      ))}
    </ul>
  );
}
