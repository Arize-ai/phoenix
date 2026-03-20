import { css } from "@emotion/react";
import type { HTMLAttributes, ReactNode } from "react";

const codeWrapCSS = css`
  border: var(--global-border-size-thin) solid
    var(--global-input-field-border-color);
  border-radius: var(--global-rounding-small);
  background-color: var(--global-input-field-background-color);
  overflow: hidden;
`;

export function CodeWrap({
  children,
  ...props
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div css={codeWrapCSS} {...props}>
      {children}
    </div>
  );
}
