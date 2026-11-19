import { useEffect, useEffectEvent, useRef, useState } from "react";
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from "react-relay";
import type {
  Disposable,
  GraphQLTaggedNode,
  OperationType,
  Subscription,
} from "relay-runtime";
import { createOperationDescriptor, getRequest } from "relay-runtime";

type QueryInput<TQuery extends OperationType> = {
  variables: TQuery["variables"];
  fetchKey: string | undefined;
  /** The variables and fetch key as one string, to compare with the requested ones. */
  key: string;
  /** What the data is about; see `subjectKey`. */
  subjectKey: string;
};

type LoadedQueryInput<TQuery extends OperationType> = QueryInput<TQuery> & {
  /** Whether a refresh loaded it, so its data is already in the store. */
  isRefresh: boolean;
};

/** A request this hook made, and the retain that holds its data. */
type QueryLoad<TQuery extends OperationType> = {
  input: QueryInput<TQuery>;
  subscription: Subscription | null;
  retained: Disposable;
};

/**
 * Reads a query like `useLazyLoadQuery`, except that new variables or a new
 * fetch key after the first load do not suspend: the query keeps returning
 * the data it has while the newer data loads, then switches to it. A refresh
 * therefore neither blanks the component nor holds up the transition that
 * changed its variables, so other content updated in that transition commits
 * without waiting for this query. The first load suspends as usual.
 *
 * One request at a time: a refresh asked for while another is loading waits
 * for it to finish and show, and only the latest refresh that waited is then
 * made, so data slower to load than the refreshes come still advances. A
 * request for another subject replaces the one loading.
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
  // The request loading, the latest refresh waiting for it, and the retains
  // of finished requests until a render shows their data.
  const loadRef = useRef<QueryLoad<TQuery> | null>(null);
  const nextRef = useRef<QueryInput<TQuery> | null>(null);
  const finishedRef = useRef<Disposable[]>([]);
  const startLoad = useEffectEvent((input: QueryInput<TQuery>) => {
    const load: QueryLoad<TQuery> = {
      input,
      subscription: null,
      // Held until the switched-to render retains the data itself, so a
      // garbage collection in between cannot drop it and make that render
      // suspend.
      retained: environment.retain(
        createOperationDescriptor(getRequest(query), input.variables)
      ),
    };
    loadRef.current = load;
    const finish = (isRefresh: boolean) => {
      if (loadRef.current !== load) {
        return;
      }
      loadRef.current = null;
      finishedRef.current.push(load.retained);
      if (!isRefresh) {
        // The switched-to render loads the data itself and reports the error.
        nextRef.current = null;
      }
      setLoaded({ ...input, isRefresh });
    };
    load.subscription = fetchQuery<TQuery>(
      environment,
      query,
      input.variables,
      { fetchPolicy: "network-only" }
    ).subscribe({
      complete: () => finish(true),
      error: () => finish(false),
    });
  });
  const cancelLoad = useEffectEvent(() => {
    const load = loadRef.current;
    loadRef.current = null;
    nextRef.current = null;
    load?.subscription?.unsubscribe();
    load?.retained.dispose();
  });
  const loadRequested = useEffectEvent((key: string) => {
    const input = { variables, fetchKey, key, subjectKey: requestedSubjectKey };
    const load = loadRef.current;
    if (load != null && load.input.subjectKey !== input.subjectKey) {
      cancelLoad();
    } else if (load != null) {
      nextRef.current = key === load.input.key ? null : input;
      return;
    }
    nextRef.current = null;
    if (key !== loaded.key) {
      startLoad(input);
    }
  });
  useEffect(
    () => loadRequested(requestedKey),
    [requestedKey, requestedSubjectKey]
  );
  useEffect(
    () => () => {
      cancelLoad();
      finishedRef.current.splice(0).forEach((retained) => retained.dispose());
    },
    []
  );
  const data = useLazyLoadQuery<TQuery>(query, loaded.variables, {
    fetchKey: loaded.fetchKey,
    fetchPolicy:
      loaded.isRefresh || loaded.fetchKey == null
        ? "store-or-network"
        : "store-and-network",
  });
  // Once a finished request's data shows, this render retains it, and the
  // refresh that waited for it can load.
  useEffect(() => {
    finishedRef.current.splice(0).forEach((retained) => retained.dispose());
    const next = nextRef.current;
    if (loadRef.current == null && next != null) {
      nextRef.current = null;
      if (next.key !== loaded.key) {
        startLoad(next);
      }
    }
  }, [loaded]);
  return {
    data,
    variables: loaded.variables,
    isOtherSubjectLoading:
      loaded.key !== requestedKey && loaded.subjectKey !== requestedSubjectKey,
  };
}
