import { css } from "@emotion/react";

import type { TextProps } from "../content";
import { Text } from "../content";
import { subtleEmptyTextCSS } from "./styles";

const innerCSS = css`
  margin: var(--global-dimension-size-300);
  display: flex;
  flex-direction: column;
  align-items: center;
`;

interface EmptyProps {
  message?: string;
  size?: TextProps["size"];
}
export function Empty(props: EmptyProps) {
  const { message, size = "M" } = props;
  return (
    <div
      css={css`
        width: 100%;
        display: flex;
        justify-content: center;
      `}
    >
      {/* Shares CompactEmptyState's subtle, theme-aware text treatment; the
          Text inherits its color via `.text` rather than setting its own. */}
      <div css={[innerCSS, subtleEmptyTextCSS]}>
        {message && <Text size={size}>{message}</Text>}
      </div>
    </div>
  );
}
