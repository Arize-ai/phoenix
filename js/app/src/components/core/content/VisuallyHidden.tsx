import { css } from "@emotion/react";
import type { AriaRole, ReactNode } from "react";

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
export const VisuallyHidden = ({
  children,
  role,
}: {
  children: ReactNode;
  /**
   * Role for the hidden span, e.g. `"status"` to make it a polite live region
   * that announces updates without showing them.
   */
  role?: AriaRole;
}) => {
  return (
    <span className="visually-hidden" css={visuallyHiddenCSS} role={role}>
      {children}
    </span>
  );
};
