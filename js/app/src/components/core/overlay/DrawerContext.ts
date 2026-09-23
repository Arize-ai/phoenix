import { createContext } from "react";

/**
 * Signals that descendants are rendered inside a {@link Drawer}. Used by
 * {@link DialogCloseButton} to pick the right default icon (collapse arrow
 * instead of the standard close ×).
 */
export const DrawerContext = createContext<boolean>(false);
