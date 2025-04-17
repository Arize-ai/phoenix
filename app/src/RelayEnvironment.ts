import fetchMultipart from "fetch-multipart-graphql";
import {
  Environment,
  FetchFunction,
  GraphQLResponse,
  Network,
  Observable,
  RecordSource,
  RequestParameters,
  Store,
  SubscribeFunction,
  Variables,
} from "relay-runtime";

import { authFetch } from "@phoenix/authFetch";
import { BASE_URL } from "@phoenix/config";

import { isObject } from "./typeUtils";

const graphQLPath = BASE_URL + "/graphql";

const isAuthenticationEnabled = window.Config.authenticationEnabled;
const graphQLFetch = isAuthenticationEnabled ? authFetch : fetch;

/**
 * Create an observable that fetches JSON from the given input and returns an error if
 * the data has errors.
 *
 * The observable aborts in-flight network requests when the unsubscribe function is
 * called.
 *
 * @param input - The input to fetch from.
 * @param init - The request init options.
 * @param hasErrors - A function that returns an error if the data has errors.
 * @returns An observable that emits the data or an error.
 */
function fetchJsonObservable<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  hasErrors?: (data: unknown) => Error | undefined
): Observable<T> {
  return Observable.create((sink) => {
    const controller = new AbortController();

    graphQLFetch(input, { ...init, signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const error = hasErrors?.(data);
        if (error) {
          throw error;
        }
        sink.next(data as T);
        sink.complete();
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          // this is triggered when the controller is aborted
          sink.complete();
        } else {
          // this is triggered when graphQLFetch throws an error or the response
          // data has errors
          sink.error(error);
        }
      });

    return () => {
      // abort the fetch request when the observable is unsubscribed
      controller.abort();
    };
  });
}

/**
 * Relay requires developers to configure a "fetch" function that tells Relay how to load
 * the results of GraphQL queries from your server (or other data source). See more at
 * https://relay.dev/docs/en/quick-start-guide#relay-environment.
 */
const fetchRelay: FetchFunction = (params, variables, _cacheConfig) =>
  fetchJsonObservable(
    graphQLPath,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: params.text,
        variables,
      }),
    },
    // GraphQL returns exceptions (for example, a missing required variable) in the "errors"
    // property of the response. If any exceptions occurred when processing the request,
    // throw an error to indicate to the developer what went wrong.
    (data) => {
      if (!isObject(data) || !("errors" in data)) {
        return;
      }
      if (Array.isArray(data.errors)) {
        return new Error(
          `Error fetching GraphQL query '${params.name}' with variables '${JSON.stringify(
            variables
          )}': ${JSON.stringify(data.errors)}`
        );
      }
    }
  );

const subscribe: SubscribeFunction = (
  operation: RequestParameters,
  variables: Variables
) => {
  return Observable.create<GraphQLResponse>((sink) => {
    fetchMultipart("/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept:
          "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json",
      },
      body: JSON.stringify({
        operationName: operation.name,
        query: operation.text as string,
        variables,
      }),
      credentials: "include",
      onNext: (parts: Array<{ payload?: GraphQLResponse }>) => {
        parts.forEach((part: { payload?: GraphQLResponse }) => {
          part?.payload && sink.next(part.payload);
        });
      },
      onError: (err: unknown) =>
        sink.error(err instanceof Error ? err : new Error(String(err))),
      onComplete: () => sink.complete(),
    });
  });
};

// Export a singleton instance of Relay Environment configured with our network layer:
export default new Environment({
  network: Network.create(fetchRelay, subscribe),
  store: new Store(new RecordSource(), {
    // This property tells Relay to not immediately clear its cache when the user
    // navigates around the app. Relay will hold onto the specified number of
    // query results, allowing the user to return to recently visited pages
    // and reusing cached data if its available/fresh.
    gcReleaseBufferSize: 10,
  }),
});
