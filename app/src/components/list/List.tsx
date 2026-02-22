import type { Ref } from "react";
import { forwardRef } from "react";

import { listCSS } from "./styles";
import type { ListProps } from "./types";

function List(
  { size = "M", children, ...otherProps }: ListProps,
  ref: Ref<HTMLUListElement>
) {
  return (
    <ul ref={ref} css={listCSS} data-list-size={size} {...otherProps}>
      {children}
    </ul>
  );
}

const _List = forwardRef(List);
export { _List as List };
