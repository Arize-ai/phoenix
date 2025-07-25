import { forwardRef } from "react";
import {
  Separator as AriaSeparator,
  SeparatorProps as AriaSeparatorProps,
} from "react-aria-components";
import { css } from "@emotion/react";

export type SeparatorProps = AriaSeparatorProps;

const separatorCSS = css`
  align-self: stretch;
  background-color: var(--ac-global-border-color-default);

  &[aria-orientation="vertical"] {
    width: 1px;
    margin: 0 var(--ac-global-dimension-size-50);
  }

  &:not([aria-orientation="vertical"]) {
    border: none;
    height: 1px;
    width: 100%;
    margin: var(--ac-global-dimension-size-50) 0;
  }
`;

function Separator(props: SeparatorProps, ref: React.Ref<HTMLDivElement>) {
  return (
    <AriaSeparator
      {...props}
      ref={ref}
      css={separatorCSS}
      className="ac-separator react-aria-Separator"
    />
  );
}

const _Separator = forwardRef(Separator);

_Separator.displayName = "Separator";

export { _Separator as Separator };
