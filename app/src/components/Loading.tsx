import React from "react";
import { ProgressCircle } from "@arizeai/components";
import { css } from "@emotion/react";

export const Loading = () => {
  return (
    <div
      css={css`
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
      `}
    >
      <ProgressCircle isIndeterminate aria-label="loading" />
    </div>
  );
};
