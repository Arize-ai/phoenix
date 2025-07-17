import { forwardRef, Ref } from "react";
import { TagGroup as AriaTagGroup, TagGroupProps } from "react-aria-components";

import { fieldBaseCSS } from "@phoenix/components/field/styles";

function TagGroup(props: TagGroupProps, ref: Ref<HTMLDivElement>) {
  return <AriaTagGroup {...props} ref={ref} css={fieldBaseCSS} />;
}

const _TagGroup = forwardRef(TagGroup);
export { _TagGroup as TagGroup };
export type { TagGroupProps };
