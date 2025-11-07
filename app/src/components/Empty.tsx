import { css } from "@emotion/react";

import { Text, TextProps } from "@phoenix/components";

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
      <div
        css={css`
          margin: var(--ac-global-dimension-size-300);
          display: flex;
          flex-direction: column;
          align-items: center;
        `}
      >
        {message && (
          <Text size={size} color="text-700">
            {message}
          </Text>
        )}
      </div>
    </div>
  );
}
