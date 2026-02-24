import { css } from "@emotion/react";
import { forwardRef } from "react";
import type { ToolbarProps as AriaToolbarProps } from "react-aria-components";
import { Toolbar as AriaToolbar } from "react-aria-components";

export type ToolbarProps = AriaToolbarProps;

const toolbarCSS = css`
  display: flex;

  gap: var(--global-dimension-size-100);

  &[data-orientation="vertical"] {
    flex-direction: column;
    align-items: start;
  }

  &[data-orientation="horizontal"] {
    flex-direction: row;
    align-items: center;
  }

  .react-aria-Group {
    display: contents;
  }
`;

function Toolbar(props: ToolbarProps, ref: React.Ref<HTMLDivElement>) {
  return (
    <AriaToolbar {...props} ref={ref} css={toolbarCSS}>
      {props.children}
    </AriaToolbar>
  );
}

const _Toolbar = forwardRef(Toolbar);

_Toolbar.displayName = "Toolbar";

export { _Toolbar as Toolbar };
