import { css } from "@emotion/react";

import { Token } from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

const ulCSS = css`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--ac-global-dimension-size-50);
`;

export type DatasetSplit = {
  readonly name: string;
  readonly color: string;
  readonly id: string;
};

export function DatasetSplits({ labels }: { labels: readonly DatasetSplit[] }) {
  const isEmpty = !labels || labels.length === 0;
  if (isEmpty) {
    return <></>;
  }
  return (
    <ul css={ulCSS}>
      {labels.map((label) => (
        <li key={`${label.name}-${label.color ?? "none"}`}>
          <Token size="M" color={label.color ?? undefined}>
            <Truncate maxWidth={200} title={label.name}>
              {label.name}
            </Truncate>
          </Token>
        </li>
      ))}
    </ul>
  );
}
