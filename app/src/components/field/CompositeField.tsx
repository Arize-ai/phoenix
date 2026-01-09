import { ReactNode } from "react";
import { css } from "@emotion/react";

export interface CompositeFieldProps {
  children: ReactNode;
}

const compositeFieldCSS = css`
  display: flex;
  min-width: 0;

  > * {
    position: relative;
    &:focus-within {
      z-index: 1;
    }
  }

  > *:not(:last-child),
  .left-child {
    border-right: none;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  > *:last-child,
  .right-child {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

export function CompositeField(props: CompositeFieldProps) {
  return (
    <div className="composite-field" css={compositeFieldCSS}>
      {props.children}
    </div>
  );
}
