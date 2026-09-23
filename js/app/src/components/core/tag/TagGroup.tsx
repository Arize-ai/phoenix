import type { Ref } from "react";
import type { TagGroupProps } from "react-aria-components";
import { TagGroup as AriaTagGroup } from "react-aria-components";

import { fieldBaseCSS } from "@phoenix/components/core/field/styles";

function TagGroup({
  ref,
  ...props
}: TagGroupProps & { ref?: Ref<HTMLDivElement> }) {
  return <AriaTagGroup {...props} ref={ref} css={fieldBaseCSS} />;
}

export { TagGroup };
export type { TagGroupProps };
