import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Blocker, Location } from "react-router";
import { useBlocker } from "react-router";

type UnsavedChangesGuard = {
  hasUnsavedChanges: boolean;
  scope?: string;
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

function isWithinScope(pathname: string, scope: string) {
  const prefix = scope.endsWith("/") ? scope.slice(0, -1) : scope;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function leavesGuard(
  guard: UnsavedChangesGuard,
  currentLocation: Location,
  nextLocation: Location
) {
  if (guard.scope != null) {
    return !isWithinScope(nextLocation.pathname, guard.scope);
  }
  return currentLocation.pathname !== nextLocation.pathname;
}

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
        leavesGuard(guard, currentLocation, nextLocation)
      ) {
        setBlockingKey(key);
        return true;
      }
    }
    return false;
  });
  const register = useCallback((key: symbol, guard: UnsavedChangesGuard) => {
    guardsRef.current.set(key, guard);
  }, []);
  const unregister = useCallback((key: symbol) => {
    guardsRef.current.delete(key);
  }, []);
  const registry = useMemo<UnsavedChangesRegistry>(
    () => ({ register, unregister, blocker, blockingKey }),
    [register, unregister, blocker, blockingKey]
  );
  return (
    <UnsavedChangesContext.Provider value={registry}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

/**
 * Guards unsaved work against navigation. In-app navigation that leaves the
 * guard's scope is blocked and surfaced through the returned blocker, which
 * drives a confirmation dialog; a reload or closed tab is confirmed by the
 * browser unless `confirmUnload` is false.
 *
 * Without a `scope`, any change of pathname leaves it and changes to the query
 * string alone pass through. With one, navigation stays within it while the
 * next pathname is the scope or below it, so an editor that outlives its
 * child routes (a page header above tabs) is not interrupted by them.
 *
 * Only the guard that blocked a navigation receives the blocked state, so
 * each caller can render its own dialog without a second one opening.
 */
export function useUnsavedChangesBlocker({
  hasUnsavedChanges,
  scope,
  confirmUnload = true,
}: {
  hasUnsavedChanges: boolean;
  scope?: string;
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
    register(key, { hasUnsavedChanges, scope });
  }, [register, key, hasUnsavedChanges, scope]);
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
