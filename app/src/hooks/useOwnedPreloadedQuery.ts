import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery, useQueryLoader } from "react-relay";
import type { GraphQLTaggedNode, OperationType } from "relay-runtime";
import invariant from "tiny-invariant";

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
  const [ownedQueryRef] = useQueryLoader<TQuery>(query, queryRef);
  invariant(
    ownedQueryRef,
    "ownedQueryRef is required when initialized from queryRef"
  );
  return usePreloadedQuery<TQuery>(query, ownedQueryRef);
}
