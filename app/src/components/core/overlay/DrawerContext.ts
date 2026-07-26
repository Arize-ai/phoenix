import { createContext } from "react";

export type DrawerResizeController = {
  /** Current allocated drawer width. */
  getSizePixels: () => number;
  /** Largest drawer width allowed by the current viewport and drawer props. */
  getMaximumSizePixels: () => number;
  /**
   * Resize without treating the change as a drawer-handle preference update.
   * Returns the clamped width that was requested.
   */
  resizeToPixels: (sizePixels: number) => number;
};

/**
 * Signals that descendants are rendered inside a {@link Drawer}. Used by
 * {@link DialogCloseButton} to pick the right default icon (collapse arrow
 * instead of the standard close ×).
 */
export const DrawerContext = createContext<boolean>(false);

/**
 * Lets a nested layout borrow drawer space during its own resize gesture.
 * This is separate from {@link DrawerContext} because most drawer descendants
 * only need to know that they are inside a drawer.
 */
export const DrawerResizeContext = createContext<DrawerResizeController | null>(
  null
);
