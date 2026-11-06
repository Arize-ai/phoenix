import { createContext, useContext, useState } from "react";

/**
 * Whether the nearest deferred container (e.g. a deferred chart panel) is
 * currently scrolled into view; `true` when there is none. Containers that
 * defer content with `useDeferredVisibility` provide it so descendants can
 * pause work while out of view.
 */
export const DeferredVisibilityContext = createContext<boolean>(true);

/**
 * Returns `value`, frozen at its last-seen state while the nearest deferred
 * container is hidden (a pass-through when in view or when there is no
 * deferred ancestor). Freeze query inputs — fetch keys, live time ranges —
 * so hidden content isn't refetched; it catches up when scrolled back in.
 */
export function useFrozenWhileHidden<T>(value: T): T {
  const isVisible = useContext(DeferredVisibilityContext);
  const [frozenValue, setFrozenValue] = useState(value);
  if (isVisible && frozenValue !== value) {
    setFrozenValue(value);
  }
  return frozenValue;
}
