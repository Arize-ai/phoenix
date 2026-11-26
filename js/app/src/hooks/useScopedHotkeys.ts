import type { HotkeyCallback, Keys, Options } from "react-hotkeys-hook";
import { useHotkeys } from "react-hotkeys-hook";

import { useHotkeysEnabled } from "@phoenix/contexts/HotkeysEnabledContext";

/**
 * `useHotkeys` that also respects the enclosing {@link HotkeysEnabledProvider}.
 *
 * Use it for shortcuts inside views that may be mounted several times at once
 * (such as each trace of the compare view) so only the copy the user is
 * working in responds. With no provider the scope is enabled, and the hook
 * behaves exactly like `useHotkeys`.
 *
 * A disabled scope ignores the key press instead of disabling the shortcut:
 * `react-hotkeys-hook` cancels the event of a shortcut whose `enabled` is a
 * function returning false, which would take the key away from the rest of
 * the page. A caller's own `ignoreEventWhen` is still honored.
 */
export function useScopedHotkeys<T extends HTMLElement>(
  keys: Keys,
  callback: HotkeyCallback,
  options?: Options
) {
  const isScopeEnabled = useHotkeysEnabled();
  const { ignoreEventWhen: shouldCallerIgnoreEvent, ...rest } = options ?? {};
  return useHotkeys<T>(keys, callback, {
    ...rest,
    ignoreEventWhen: (keyboardEvent) =>
      !isScopeEnabled || (shouldCallerIgnoreEvent?.(keyboardEvent) ?? false),
  });
}
