import { PropsWithChildren } from "react";
import { css, keyframes } from "@emotion/react";

const riseIn = keyframes`
  from {
    transform: translate(-50%, var(--ac-global-dimension-size-450));
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
`;

const containerCSS = css`
  position: absolute;
  bottom: var(--ac-global-dimension-size-450);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  box-shadow:
    0px 10px 20px 0px rgba(0, 0, 0, 0.1),
    0px 4px 8px 0px rgba(0, 0, 0, 0.1);
  border-radius: var(--ac-global-rounding-medium);
  padding: var(--ac-global-dimension-size-100);
  background-color: var(--ac-floating-toolbar-background-color);
  border: 1px solid var(--ac-floating-toolbar-border-color);
  animation: ${riseIn} 0.1s ease-in-out;
`;

/**
 * A component that wraps a toolbar that floats above the content.
 */
export const FloatingToolbarContainer = ({ children }: PropsWithChildren) => {
  return <div css={containerCSS}>{children}</div>;
};
