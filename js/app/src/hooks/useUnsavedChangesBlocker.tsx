import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Blocker } from "react-router";
import { useBlocker } from "react-router";

type UnsavedChangesGuard = {
  hasUnsavedChanges: boolean;
};

type UnsavedChangesRegistry = {
  register: (key: symbol, guard: UnsavedChangesGuard) => void;
  unregister: (key: symbol) => void;
  blocker: Blocker;
  blockingKey: symbol | null;
};

const UnsavedChangesContext = createContext<UnsavedChangesRegistry | null>(
  null
);

const UNBLOCKED: Blocker = {
  state: "unblocked",
  proceed: undefined,
  reset: undefined,
  location: undefined,
};

/**
 * Owns the router's only navigation blocker. React Router consults just the
 * most recently registered `useBlocker`, so editors that guard unsaved work at
 * the same time (a page header and a table on one page) register with this
 * provider instead of calling `useBlocker` themselves.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const guardsRef = useRef(new Map<symbol, UnsavedChangesGuard>());
  const [blockingKey, setBlockingKey] = useState<symbol | null>(null);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    for (const [key, guard] of guardsRef.current) {
      if (
        guard.hasUnsavedChanges &&
        currentLocation.pathname !== nextLocation.pathname
      ) {
        setBlockingKey(key);
        return true;
      }
    }
    return false;
  });
  const registry: UnsavedChangesRegistry = {
    register: (key, guard) => {
      guardsRef.current.set(key, guard);
    },
    unregister: (key) => {
      guardsRef.current.delete(key);
    },
    blocker,
    blockingKey,
  };
  return (
    <UnsavedChangesContext.Provider value={registry}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

/**
 * Guards unsaved work against navigation. In-app navigation that leaves the
 * current pathname is blocked and surfaced through the returned blocker, which
 * drives a confirmation dialog; changes to the query string alone pass
 * through. A reload or closed tab is confirmed by the browser unless
 * `confirmUnload` is false.
 *
 * Only the guard that blocked a navigation receives the blocked state, so
 * each caller can render its own dialog without a second one opening.
 */
export function useUnsavedChangesBlocker({
  hasUnsavedChanges,
  confirmUnload = true,
}: {
  hasUnsavedChanges: boolean;
  confirmUnload?: boolean;
}): Blocker {
  const registry = useContext(UnsavedChangesContext);
  if (registry == null) {
    throw new Error(
      "useUnsavedChangesBlocker must be used within an UnsavedChangesProvider"
    );
  }
  const { register, unregister } = registry;
  const [key] = useState(() => Symbol("unsaved-changes-guard"));
  useEffect(() => {
    register(key, { hasUnsavedChanges });
  }, [register, key, hasUnsavedChanges]);
  useEffect(() => () => unregister(key), [unregister, key]);
  useEffect(() => {
    if (!hasUnsavedChanges || !confirmUnload) {
      return undefined;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy engines show the prompt only when returnValue is set.
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges, confirmUnload]);
  return registry.blockingKey === key ? registry.blocker : UNBLOCKED;
}
