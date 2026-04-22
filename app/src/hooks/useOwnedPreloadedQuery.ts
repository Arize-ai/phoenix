import { useEffect } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import type { GraphQLTaggedNode, OperationType } from "relay-runtime";

export type OwnedPreloadedQueryRef<TQuery extends OperationType> =
  PreloadedQuery<TQuery> & {
    dispose?: () => void;
  };

/**
 * Reads a preloaded query and disposes the query reference when this component
 * no longer owns it.
 *
 * Use this only for query refs whose lifecycle is owned by the current
 * component, such as refs returned from a route loader via `loadQuery`.
 */
export function useOwnedPreloadedQuery<TQuery extends OperationType>({
  query,
  queryRef,
}: {
  query: GraphQLTaggedNode;
  queryRef: OwnedPreloadedQueryRef<TQuery>;
}) {
  const data = usePreloadedQuery<TQuery>(query, queryRef);

  useEffect(() => {
    return () => {
      queryRef.dispose?.();
    };
  }, [queryRef]);

  return data;
}
