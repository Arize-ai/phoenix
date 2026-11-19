import { useEffect, useEffectEvent, useState } from "react";
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from "react-relay";
import type { GraphQLTaggedNode, OperationType } from "relay-runtime";
import { createOperationDescriptor, getRequest } from "relay-runtime";

type LoadedQueryInput<TQuery extends OperationType> = {
  variables: TQuery["variables"];
  fetchKey: string | undefined;
  /** The variables and fetch key as one string, to compare with the requested ones. */
  key: string;
  /** What the data is about; see `subjectKey`. */
  subjectKey: string;
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
 * @param params.subjectKey - what the data is about, apart from how fresh it
 * is (e.g. a project and a live preset, whose bounds move on each refresh).
 * New variables under the same subject key refresh the data; under another
 * one they load other data. Defaults to the variables, so that only a new
 * fetch key refreshes.
 * @returns the data; the variables it was loaded with, which while newer
 * variables load are the previous ones; and `isOtherSubjectLoading`, set while
 * the data is for another subject than the one requested, so a caller can
 * show that it is loading rather than show the other subject's data.
 */
export function useRefreshingLazyLoadQuery<TQuery extends OperationType>({
  query,
  variables,
  fetchKey,
  subjectKey,
}: {
  query: GraphQLTaggedNode;
  variables: TQuery["variables"];
  fetchKey?: string;
  subjectKey?: string;
}): {
  data: TQuery["response"];
  variables: TQuery["variables"];
  isOtherSubjectLoading: boolean;
} {
  const environment = useRelayEnvironment();
  const requestedKey = `${JSON.stringify(variables)}|${fetchKey ?? ""}`;
  const requestedSubjectKey = subjectKey ?? JSON.stringify(variables);
  const [loaded, setLoaded] = useState<LoadedQueryInput<TQuery>>(() => ({
    variables,
    fetchKey,
    key: requestedKey,
    subjectKey: requestedSubjectKey,
    isRefresh: false,
  }));
  const loadRequested = useEffectEvent((key: string) => {
    if (key === loaded.key) {
      return undefined;
    }
    const requested = {
      variables,
      fetchKey,
      key,
      subjectKey: requestedSubjectKey,
    };
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
  return {
    data,
    variables: loaded.variables,
    isOtherSubjectLoading:
      loaded.key !== requestedKey && loaded.subjectKey !== requestedSubjectKey,
  };
}
