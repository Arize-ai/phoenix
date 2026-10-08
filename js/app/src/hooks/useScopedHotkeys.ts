import type { HotkeyCallback, Keys, Options } from "react-hotkeys-hook";
import { useHotkeys } from "react-hotkeys-hook";

import { useHotkeysEnabled } from "@phoenix/contexts/HotkeysEnabledContext";

/**
 * `useHotkeys` that also respects the enclosing {@link HotkeysEnabledProvider}.
 *
 * Use it for shortcuts inside views that may be mounted several times at once
 * (such as each trace of the compare view) so only the copy the user is
 * working in responds. With no provider the scope is enabled, and the hook
 * behaves exactly like `useHotkeys`. A caller's own `enabled` option is still
 * honored, so a shortcut responds only when both the scope and the caller
 * allow it.
 */
export function useScopedHotkeys<T extends HTMLElement>(
  keys: Keys,
  callback: HotkeyCallback,
  options?: Options
) {
  const isScopeEnabled = useHotkeysEnabled();
  const { enabled: isCallerEnabled = true, ...rest } = options ?? {};
  return useHotkeys<T>(keys, callback, {
    ...rest,
    enabled: (keyboardEvent, hotkeysEvent) =>
      isScopeEnabled &&
      (typeof isCallerEnabled === "function"
        ? isCallerEnabled(keyboardEvent, hotkeysEvent)
        : isCallerEnabled),
  });
}
