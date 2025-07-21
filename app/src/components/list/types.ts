import { ComponentSize } from "@phoenix/components/types";

export interface ListProps {
  /**
   * The size of the list
   * @default 'M'
   */
  listSize?: Omit<ComponentSize, "L">;
}
