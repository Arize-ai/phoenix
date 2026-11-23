import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery, useQueryLoader } from "react-relay";
import type { GraphQLTaggedNode, OperationType } from "relay-runtime";
import invariant from "tiny-invariant";

export type OwnedPreloadedQueryRef<TQuery extends OperationType> =
  PreloadedQuery<TQuery> & {
    dispose?: () => void;
  };

/**
 * Takes ownership of a query reference this component did not create and
 * disposes it when this component no longer owns it. Does not read the query,
 * so the owner does not suspend; readers elsewhere in the tree can read the
 * returned reference.
 *
 * Use this only for query refs whose lifecycle is owned by the current
 * component, such as refs returned from a route loader via `loadQuery`.
 */
export function useOwnedQueryReference<TQuery extends OperationType>({
  query,
  queryRef,
}: {
  query: GraphQLTaggedNode;
  queryRef: OwnedPreloadedQueryRef<TQuery>;
}): PreloadedQuery<TQuery> {
  const [ownedQueryRef] = useQueryLoader<TQuery>(query, queryRef);
  invariant(
    ownedQueryRef,
    "ownedQueryRef is required when initialized from queryRef"
  );
  return ownedQueryRef;
}

/**
 * Reads a preloaded query and disposes the query reference when this component
 * no longer owns it. See {@link useOwnedQueryReference} for when a component
 * owns a ref.
 */
export function useOwnedPreloadedQuery<TQuery extends OperationType>({
  query,
  queryRef,
}: {
  query: GraphQLTaggedNode;
  queryRef: OwnedPreloadedQueryRef<TQuery>;
}) {
  const ownedQueryRef = useOwnedQueryReference<TQuery>({ query, queryRef });
  return usePreloadedQuery<TQuery>(query, ownedQueryRef);
}
