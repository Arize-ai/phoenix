import { css } from "@emotion/react";

import { Text } from "@phoenix/components/core/content";

const metricCSS = css`
  min-width: 120px;
  flex: 1 1 120px;
  border: 1px solid var(--global-color-gray-300);
  border-radius: var(--global-rounding-small);
  padding: var(--global-dimension-size-150);
  background: var(--global-color-gray-50);
`;

const metricValueCSS = css`
  margin-top: var(--global-dimension-size-50);
`;

export function Metric({
  label,
  value,
  change,
}: {
  label: string;
  value: string | number;
  change: string | null;
}) {
  return (
    <div css={metricCSS}>
      <Text color="text-700" size="XS">
        {label}
      </Text>
      <div css={metricValueCSS}>
        <Text size="L" weight="heavy">
          {String(value)}
        </Text>
      </div>
      {change ? (
        <Text color="text-700" size="XS">
          {change}
        </Text>
      ) : null}
    </div>
  );
}
