import { ReactNode } from "react";
import { css } from "@emotion/react";

const visuallyHiddenCSS = css`
  border: 0;
  clip: rect(0 0 0 0);
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
  height: 1px;
`;
/**
 * Component for only displaying content to screen readers.
 */
export const VisuallyHidden = ({ children }: { children: ReactNode }) => {
  return (
    <span className="ac-visually-hidden" css={visuallyHiddenCSS}>
      {children}
    </span>
  );
};
