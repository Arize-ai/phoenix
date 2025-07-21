import { HTMLProps } from "react";

import { ComponentSize } from "@phoenix/components/types";

export interface ListProps extends HTMLProps<HTMLUListElement> {
  /**
   * The size of the list
   * @default 'M'
   */
  listSize?: Exclude<ComponentSize, "L">;
}
