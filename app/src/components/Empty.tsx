import React from "react";
import { css } from "@emotion/react";

import { EmptyGraphic, EmptyGraphicProps, Text } from "@arizeai/components";

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
        css={(theme) =>
          css`
            margin: ${theme.spacing.margin24}px;
            display: flex;
            flex-direction: column;
            align-items: center;
          `
        }
      >
        <EmptyGraphic {...graphicsProps} />
        {message && <Text>{message}</Text>}
      </div>
    </div>
  );
}
