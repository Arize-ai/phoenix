import { useEffect, useEffectEvent, useState } from "react";
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from "react-relay";
import type { GraphQLTaggedNode, OperationType } from "relay-runtime";
import { createOperationDescriptor, getRequest } from "relay-runtime";

type LoadedQueryInput<TQuery extends OperationType> = {
  variables: TQuery["variables"];
  fetchKey: string | undefined;
  /** The variables and fetch key as one string, to compare with the requested ones. */
  key: string;
  /** Whether a refresh loaded it, so its data is already in the store. */
  isRefresh: boolean;
};

/**
 * Reads a query like `useLazyLoadQuery`, except that new variables or a new
 * fetch key after the first load do not suspend: the query keeps returning
 * the data it has while the newer data loads, then switches to it. A refresh
 * therefore neither blanks the component nor holds up the transition that
 * changed its variables, so other content updated in that transition commits
 * without waiting for this query. The first load suspends as usual.
 *
 * With a fetch key the first load is store-and-network, as for live charts;
 * without one it reads the store first and fetches once.
 *
 * @param params - the query and its inputs
 * @param params.query - the query to read
 * @param params.variables - the query's variables
 * @param params.fetchKey - refetches whenever it changes
 * @returns the data, and the variables it was loaded with: while newer
 * variables load these are the previous ones, so a caller can tell that the
 * data is for an earlier input (e.g. another time range) and say so.
 */
export function useRefreshingLazyLoadQuery<TQuery extends OperationType>({
  query,
  variables,
  fetchKey,
}: {
  query: GraphQLTaggedNode;
  variables: TQuery["variables"];
  fetchKey?: string;
}): { data: TQuery["response"]; variables: TQuery["variables"] } {
  const environment = useRelayEnvironment();
  const requestedKey = `${JSON.stringify(variables)}|${fetchKey ?? ""}`;
  const [loaded, setLoaded] = useState<LoadedQueryInput<TQuery>>(() => ({
    variables,
    fetchKey,
    key: requestedKey,
    isRefresh: false,
  }));
  const loadRequested = useEffectEvent((key: string) => {
    if (key === loaded.key) {
      return undefined;
    }
    const requested = { variables, fetchKey, key };
    // Held until the switched-to render retains the data itself, so a garbage
    // collection in between cannot drop it and make that render suspend.
    const retained = environment.retain(
      createOperationDescriptor(getRequest(query), variables)
    );
    const subscription = fetchQuery<TQuery>(environment, query, variables, {
      fetchPolicy: "network-only",
    }).subscribe({
      complete: () => setLoaded({ ...requested, isRefresh: true }),
      error: () => setLoaded({ ...requested, isRefresh: false }),
    });
    return () => {
      subscription.unsubscribe();
      retained.dispose();
    };
  });
  useEffect(() => loadRequested(requestedKey), [requestedKey]);
  const data = useLazyLoadQuery<TQuery>(query, loaded.variables, {
    fetchKey: loaded.fetchKey,
    fetchPolicy:
      loaded.isRefresh || loaded.fetchKey == null
        ? "store-or-network"
        : "store-and-network",
  });
  return { data, variables: loaded.variables };
}
