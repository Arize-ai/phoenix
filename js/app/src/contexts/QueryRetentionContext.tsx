import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useRelayEnvironment } from "react-relay";
import type { Disposable, OperationDescriptor } from "relay-runtime";

type RetainQuery = (operation: OperationDescriptor) => void;

const QueryRetentionContext = createContext<RetainQuery | null>(null);

/**
 * Keeps every query retained beneath it in the Relay store until it unmounts,
 * so a surface that fetches as the user browses (a tooltip per row, say) shows
 * what it already fetched at once instead of refetching after Relay's release
 * buffer has collected it.
 */
export function QueryRetentionProvider({ children }: PropsWithChildren) {
  const environment = useRelayEnvironment();
  const [retained] = useState(() => new Map<string, Disposable>());
  // Disposal has to follow unmount, which only an effect cleanup observes
  useEffect(() => {
    return () => {
      retained.forEach((disposable) => disposable.dispose());
      retained.clear();
    };
  }, [retained]);
  const retainQuery: RetainQuery = (operation) => {
    const key = operation.request.identifier;
    if (!retained.has(key)) {
      retained.set(key, environment.retain(operation));
    }
  };
  return (
    <QueryRetentionContext.Provider value={retainQuery}>
      {children}
    </QueryRetentionContext.Provider>
  );
}

/**
 * Retains `operation` until the nearest {@link QueryRetentionProvider}
 * unmounts. A no-op outside one.
 */
export function useRetainQuery(operation: OperationDescriptor) {
  useContext(QueryRetentionContext)?.(operation);
}
