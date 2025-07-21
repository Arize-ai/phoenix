import { HTMLProps } from "react";

import { ComponentSize } from "@phoenix/components/types";

export interface ListProps extends Omit<HTMLProps<HTMLUListElement>, "size"> {
  /**
   * The size of the list
   * @default 'M'
   */
  size?: Exclude<ComponentSize, "L">;
}
