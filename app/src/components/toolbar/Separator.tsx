import { css } from "@emotion/react";
import { forwardRef } from "react";
import type { SeparatorProps as AriaSeparatorProps } from "react-aria-components";
import { Separator as AriaSeparator } from "react-aria-components";

export type SeparatorProps = AriaSeparatorProps;

const separatorCSS = css`
  align-self: stretch;
  background-color: var(--global-border-color-default);

  &[aria-orientation="vertical"] {
    width: 1px;
    margin: 0 var(--global-dimension-size-50);
  }

  &:not([aria-orientation="vertical"]) {
    border: none;
    height: 1px;
    width: 100%;
    margin: var(--global-dimension-size-50) 0;
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
