import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";

/**
 * Whether keyboard shortcuts registered below this point should respond.
 * Defaults to enabled so views with a single set of shortcuts need no provider.
 */
const HotkeysEnabledContext = createContext<boolean>(true);

/**
 * Returns whether shortcuts registered in this subtree should respond. Views
 * that mount the same shortcuts several times at once (such as the compare
 * traces view) enable only the copy the user is working in, so one key press
 * does not act on every copy.
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
