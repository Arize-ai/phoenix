import { readMultipartBody } from "@apollo/client/link/http/parseAndCheckHttpResponse";
import {
  Environment,
  type FetchFunction,
  type GraphQLResponse,
  Network,
  Observable,
  RecordSource,
  Store,
  type SubscribeFunction,
} from "relay-runtime";
import invariant from "tiny-invariant";

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
      .then((response) => {
        invariant(response instanceof Response, "response must be a Response");
        return response.json();
      })
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

/**
 * Custom multipart subscription function that properly supports cancellation.
 *
 * Apollo's createFetchMultipartSubscription doesn't use AbortController,
 * so dispose() has no effect. This implementation fixes that by:
 * 1. Creating an AbortController for each subscription
 * 2. Passing the signal to fetch
 * 3. Returning a cleanup function that aborts the fetch
 *
 * @see https://github.com/apollographql/apollo-client/blob/c33652da7c239275720831338f40674765897be7/src/utilities/subscriptions/relay/index.ts#L35-L61
 */
function createSubscribe(
  uri: string,
  fetchFn: typeof fetch
): SubscribeFunction {
  return (operation, variables) => {
    return Observable.create<GraphQLResponse>((sink) => {
      const controller = new AbortController();

      const body = JSON.stringify({
        operationName: operation.name,
        variables,
        query: operation.text || "",
      });

      fetchFn(uri, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept:
            "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json",
        },
        body,
        signal: controller.signal,
      })
        .then((response) => {
          const ctype = response.headers?.get("content-type");

          if (ctype !== null && /^multipart\/mixed/i.test(ctype)) {
            return readMultipartBody(response, (value: GraphQLResponse) => {
              sink.next(value);
            });
          }

          throw new Error("Expected multipart response");
        })
        .then(() => {
          sink.complete();
        })
        .catch((err: Error) => {
          if (err.name === "AbortError") {
            // Subscription was cancelled - complete normally
            sink.complete();
          } else {
            sink.error(err);
          }
        });

      // Return cleanup function that aborts the fetch
      return () => {
        controller.abort();
      };
    });
  };
}

const subscribe = createSubscribe(graphQLPath, graphQLFetch);

// Export a singleton instance of Relay Environment configured with our network layer:
export default new Environment({
  network: Network.create(fetchRelay, subscribe),
  store: new Store(new RecordSource(), {
    // This property tells Relay to not immediately clear its cache when the user
    // navigates around the app. Relay will hold onto the specified number of
    // query results, allowing the user to return to recently visited pages
    // and reusing cached data if its available/fresh.
    gcReleaseBufferSize: 20,
  }),
});
