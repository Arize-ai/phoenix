import { css } from "@emotion/react";

import { Text } from "@phoenix/components";

interface EmptyProps {
  message?: string;
}
export function Empty(props: EmptyProps) {
  const { message } = props;
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
          <Text size="M" color="text-700">
            {message}
          </Text>
        )}
      </div>
    </div>
  );
}
