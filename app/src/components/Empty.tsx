import { css } from "@emotion/react";

import { EmptyGraphic, EmptyGraphicProps } from "@arizeai/components";

import { Text } from "@phoenix/components";

interface EmptyProps extends EmptyGraphicProps {
  message?: string;
}
export function Empty(props: EmptyProps) {
  const { message, ...graphicsProps } = props;
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
        <EmptyGraphic {...graphicsProps} />
        {message && <Text>{message}</Text>}
      </div>
    </div>
  );
}
