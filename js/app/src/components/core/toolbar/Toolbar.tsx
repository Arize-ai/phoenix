import { css } from "@emotion/react";
import type { Ref } from "react";
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

function Toolbar({
  ref,
  ...props
}: ToolbarProps & { ref?: Ref<HTMLDivElement> }) {
  return (
    <AriaToolbar {...props} ref={ref} css={toolbarCSS}>
      {props.children}
    </AriaToolbar>
  );
}

export { Toolbar };
