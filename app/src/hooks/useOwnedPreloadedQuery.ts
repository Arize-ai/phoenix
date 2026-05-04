import { useRef } from "react";
import type { PreloadedQuery } from "react-relay";
import { loadQuery, usePreloadedQuery, useQueryLoader } from "react-relay";
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
  // const revivedDisposedQueryRef = useRef<{
  //   sourceQueryRef: OwnedPreloadedQueryRef<TQuery>;
  //   queryRef: OwnedPreloadedQueryRef<TQuery>;
  // } | null>(null);

  // let initialOwnedQueryRef = queryRef;

  // // Route loaders can hand the same query ref back to a component after that
  // // component previously unmounted and released it. When that happens, Relay
  // // warns if we try to read the disposed ref again, so recreate a fresh owned
  // // ref from the original query metadata before handing it to usePreloadedQuery.
  // if (queryRef.isDisposed) {
  //   if (revivedDisposedQueryRef.current?.sourceQueryRef !== queryRef) {
  //     revivedDisposedQueryRef.current = {
  //       sourceQueryRef: queryRef,
  //       queryRef: loadQuery<TQuery>(
  //         queryRef.environment,
  //         query,
  //         queryRef.variables,
  //         {
  //           fetchPolicy: queryRef.fetchPolicy,
  //           networkCacheConfig: queryRef.networkCacheConfig,
  //         }
  //       ) as OwnedPreloadedQueryRef<TQuery>,
  //     };
  //   }
  //   initialOwnedQueryRef = revivedDisposedQueryRef.current.queryRef;
  // }

  // const [ownedQueryRef] = useQueryLoader<TQuery>(query, initialOwnedQueryRef);
  const [ownedQueryRef] = useQueryLoader<TQuery>(query, queryRef);
  invariant(
    ownedQueryRef,
    "ownedQueryRef is required when initialized from queryRef"
  );
  return usePreloadedQuery<TQuery>(query, ownedQueryRef);
}
