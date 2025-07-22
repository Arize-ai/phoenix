import { PropsWithChildren } from "react";
import { css, keyframes } from "@emotion/react";

const riseIn = keyframes`
  from {
    transform: translate(-50%, var(--ac-global-dimension-size-600));
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
`;

const containerCSS = css`
  position: absolute;
  bottom: var(--ac-global-dimension-size-600);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  box-shadow: 8px 8px 20px 0 rgba(0, 0, 0, 0.4);
  border-radius: var(--ac-global-rounding-small);
  padding: var(--ac-global-dimension-size-100);
  background-color: var(--ac-global-color-grey-75);
  border: 1px solid var(--ac-global-color-grey-200);
  animation: ${riseIn} 0.2s ease-in-out;
`;

/**
 * A component that wraps a toolbar that floats above the content.
 */
export const FloatingToolbarContainer = ({ children }: PropsWithChildren) => {
  return <div css={containerCSS}>{children}</div>;
};
