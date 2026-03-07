import { css } from "@emotion/react";

import { Icon } from "./Icon";
import { RecordOutline } from "./Icons";

export interface RecordIconProps {
  isActive?: boolean;
}

export const RecordIcon = ({ isActive = false }: RecordIconProps) => {
  return (
    <Icon
      svg={<RecordOutline />}
      css={
        isActive
          ? css`
              color: var(--recording-indicator-color);
              animation: recording-pulse 1.5s ease-in-out infinite;
            `
          : undefined
      }
    />
  );
};
