import type { Ref } from "react";

import { listCSS } from "./styles";
import type { ListProps } from "./types";

function List({
  ref,
  size = "M",
  children,
  ...otherProps
}: ListProps & { ref?: Ref<HTMLUListElement> }) {
  return (
    <ul ref={ref} css={listCSS} data-list-size={size} {...otherProps}>
      {children}
    </ul>
  );
}

export { List };
