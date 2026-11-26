import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";

/**
 * Whether keyboard shortcuts registered below this point should respond.
 * Defaults to enabled so views with a single set of shortcuts need no provider.
 */
const HotkeysEnabledContext = createContext<boolean>(true);

/**
 * Returns whether shortcuts registered in this subtree should respond.
 * Register shortcuts with `useScopedHotkeys`, which applies this for you.
 */
export function useHotkeysEnabled(): boolean {
  return useContext(HotkeysEnabledContext);
}

/**
 * Enables or disables the keyboard shortcuts registered by its descendants.
 * A provider inside a disabled one stays disabled, so a view that picks its
 * active pane cannot switch shortcuts back on under an overlay.
 */
export function HotkeysEnabledProvider({
  isEnabled,
  children,
}: PropsWithChildren<{ isEnabled: boolean }>) {
  const isParentEnabled = useHotkeysEnabled();
  return (
    <HotkeysEnabledContext.Provider value={isEnabled && isParentEnabled}>
      {children}
    </HotkeysEnabledContext.Provider>
  );
}
