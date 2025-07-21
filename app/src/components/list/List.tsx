import { forwardRef, PropsWithChildren, Ref } from "react";

import { listCSS } from "./styles";
import { ListProps } from "./types";

function List(
  { listSize = "M", children }: PropsWithChildren<ListProps>,
  ref: Ref<HTMLUListElement>
) {
  return (
    <ul ref={ref} css={listCSS} data-list-size={listSize}>
      {children}
    </ul>
  );
}

const _List = forwardRef(List);
export { _List as List };
