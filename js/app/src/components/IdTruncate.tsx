import { css } from "@emotion/react";

import type { TextProps } from "@phoenix/components";
import { Text } from "@phoenix/components";

const idTruncateCSS = css`
  text-decoration: underline;
  text-underline-offset: 4px;
  font-family: monospace;
`;

/**
 * Character based truncation for IDs.
 * Truncates from the start, preserving the last 6 characters (by default).
 * Adds underline as an affordance for hovering, to show the un-truncated ID.
 */
export function IdTruncate({
  id,
  length = 6,
  textProps,
  ellipsis,
}: {
  id: string;
  length?: number;
  textProps?: Partial<TextProps>;
  ellipsis?: boolean;
}) {
  const truncatedValue = id.length <= length ? id : id.slice(length * -1);

  return (
    <Text title={id} css={idTruncateCSS} {...textProps}>
      {ellipsis ? <>&hellip;</> : ""}
      {truncatedValue}
    </Text>
  );
}
