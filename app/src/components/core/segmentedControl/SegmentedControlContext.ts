import { createContext } from "react";
import type { RefObject } from "react";

/** The outgoing item's position within the segmented-control track. */
export const SegmentedControlItemOffsetContext = createContext<RefObject<
  number | null
> | null>(null);
