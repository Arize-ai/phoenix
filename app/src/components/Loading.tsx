import React from "react";
import { css } from "@emotion/react";

import { ProgressCircle, Text } from "@arizeai/components";

type LoadingProps = { message?: string };
export const Loading = ({ message }: LoadingProps) => {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        gap: var(--px-spacing-med);
      `}
    >
      <ProgressCircle isIndeterminate aria-label="loading" />
      {message != null ? <Text>{message}</Text> : null}
    </div>
  );
};
