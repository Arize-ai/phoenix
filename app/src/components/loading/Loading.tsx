import { ComponentProps } from "react";
import { css } from "@emotion/react";

import { ProgressCircle } from "@arizeai/components";

import { Text } from "@phoenix/components";

type LoadingProps = {
  message?: string;
  size?: ComponentProps<typeof ProgressCircle>["size"];
  className?: string;
};

export const Loading = ({ message, size, className }: LoadingProps) => {
  return (
    <div
      className={className}
      css={css`
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        gap: var(--ac-global-dimension-static-size-100);
      `}
    >
      <ProgressCircle isIndeterminate aria-label="loading" size={size} />
      {message != null ? <Text>{message}</Text> : null}
    </div>
  );
};
