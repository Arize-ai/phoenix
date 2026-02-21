import type { Ref } from "react";
import { forwardRef } from "react";
import type { TagGroupProps } from "react-aria-components";
import { TagGroup as AriaTagGroup } from "react-aria-components";

import { fieldBaseCSS } from "@phoenix/components/field/styles";

function TagGroup(props: TagGroupProps, ref: Ref<HTMLDivElement>) {
  return <AriaTagGroup {...props} ref={ref} css={fieldBaseCSS} />;
}

const _TagGroup = forwardRef(TagGroup);
export { _TagGroup as TagGroup };
export type { TagGroupProps };
