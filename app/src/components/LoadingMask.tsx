import { css } from "@emotion/react";

import { ProgressCircle } from "@arizeai/components";

export const LoadingMask = () => {
  return (
    <div
      css={css`
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.2);
      `}
    >
      <ProgressCircle isIndeterminate aria-label="loading" />
    </div>
  );
};
