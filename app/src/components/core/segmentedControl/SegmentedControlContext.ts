import { createContext } from "react";

/**
 * Lets the selected item hand its element to the track on the commit that
 * applies a selection. The track uses it to position its thumb and to restore
 * the scroll anchor captured when the selection was changed.
 */
export interface SegmentedControlSelectionRegistry {
  /** Registers `item` as the selected segment; returns an unregister callback. */
  registerSelectedItem: (item: HTMLElement) => () => void;
}

export const SegmentedControlSelectionContext =
  createContext<SegmentedControlSelectionRegistry | null>(null);
