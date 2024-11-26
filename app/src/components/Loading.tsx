import React, { ComponentProps } from "react";
import { css } from "@emotion/react";

import { ProgressCircle, Text } from "@arizeai/components";

type LoadingProps = {
  message?: string;
  size?: ComponentProps<typeof ProgressCircle>["size"];
};
export const Loading = ({ message, size }: LoadingProps) => {
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
      <ProgressCircle isIndeterminate aria-label="loading" size={size} />
      {message != null ? <Text>{message}</Text> : null}
    </div>
  );
};
