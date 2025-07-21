import { PropsWithChildren } from "react";
import { css } from "@emotion/react";

const containerCSS = css`
  position: absolute;
  bottom: var(--ac-global-dimension-size-600);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  box-shadow: 8px 8px 20px 0 rgba(0, 0, 0, 0.4);
  border-radius: var(--ac-global-rounding-medium);
  padding: var(--ac-global-dimension-size-200);
  background-color: var(--ac-global-color-grey-75);
`;

/**
 * A component that wraps a toolbar that floats above the content.
 */
export const FloatingToolbarContainer = ({ children }: PropsWithChildren) => {
  return <div css={containerCSS}>{children}</div>;
};
