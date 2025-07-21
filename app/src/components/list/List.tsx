import { forwardRef, Ref } from "react";

import { listCSS } from "./styles";
import { ListProps } from "./types";

function List(
  { listSize = "M", children, ...otherProps }: ListProps,
  ref: Ref<HTMLUListElement>
) {
  return (
    <ul ref={ref} css={listCSS} data-list-size={listSize} {...otherProps}>
      {children}
    </ul>
  );
}

const _List = forwardRef(List);
export { _List as List };
