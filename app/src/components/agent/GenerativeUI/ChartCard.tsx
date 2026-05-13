import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Heading, Text } from "@phoenix/components/core/content";

const chartCardCSS = css`
  display: grid;
  gap: var(--global-dimension-size-100);
`;

export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string | null;
  children?: ReactNode;
}) {
  return (
    <div css={chartCardCSS}>
      <Heading level={4} weight="heavy">
        {title}
      </Heading>
      {subtitle ? (
        <Text elementType="p" color="text-700">
          {subtitle}
        </Text>
      ) : null}
      {children}
    </div>
  );
}
