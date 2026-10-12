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
 */
export function HotkeysEnabledProvider({
  isEnabled,
  children,
}: PropsWithChildren<{ isEnabled: boolean }>) {
  return (
    <HotkeysEnabledContext.Provider value={isEnabled}>
      {children}
    </HotkeysEnabledContext.Provider>
  );
}
