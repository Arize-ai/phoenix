import { css, keyframes } from "@emotion/react";

import { Icon } from "./Icon";
import { RecordOutline } from "./Icons";

const recordingPulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
`;

const recordIconCSS = css`
  &[data-active] {
    color: var(--global-color-red-600);
    svg circle:last-child {
      animation: ${recordingPulse} 1.5s ease-in-out infinite;
    }
  }
`;

export interface RecordIconProps {
  isActive?: boolean;
}

export const RecordIcon = ({ isActive = false }: RecordIconProps) => {
  return (
    <Icon
      svg={<RecordOutline />}
      css={recordIconCSS}
      data-active={isActive || undefined}
    />
  );
};
